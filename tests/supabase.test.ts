import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { seed } from "../lib/seed";
let db: PGlite;
const alice = "11111111-1111-4111-8111-111111111111",
  bob = "22222222-2222-4222-8222-222222222222";
async function asUser(id: string) {
  await db.exec(
    `reset role;set role authenticated;select set_config('request.jwt.claim.sub','${id}',false);`,
  );
}
describe("Supabase migration and ownership policies", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(
      `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;insert into auth.users values ('${alice}'),('${bob}');`,
    );
    await db.exec(
      readFileSync("supabase/migrations/202610260001_workspaces.sql", "utf8"),
    );
    await db.exec(
      readFileSync(
        "supabase/migrations/202610270001_reservation_sync.sql",
        "utf8",
      ),
    );
  }, 20000);
  afterAll(async () => {
    await db.close();
  });
  it("creates only the current user workspace and increments revisions atomically", async () => {
    await asUser(alice);
    const state = seed();
    const initial = await db.query<{ workspace: typeof state }>(
      "select public.load_or_create_workspace($1::jsonb) as workspace",
      [JSON.stringify(state)],
    );
    expect(initial.rows[0].workspace.revision).toBe(0);
    state.expeditions[0].title = "Alice private trip";
    const saved = await db.query<{ workspace: typeof state }>(
      "select public.save_workspace($1::jsonb,0) as workspace",
      [JSON.stringify(state)],
    );
    expect(saved.rows[0].workspace.revision).toBe(1);
    await expect(
      db.query("select public.save_workspace($1::jsonb,0)", [
        JSON.stringify(state),
      ]),
    ).rejects.toThrow("Conflict");
  });
  it("blocks reading, updating or inserting another user’s data", async () => {
    await asUser(bob);
    expect(
      (await db.query("select * from public.user_workspaces")).rows,
    ).toHaveLength(0);
    expect(
      (
        await db.query(
          "update public.user_workspaces set revision=revision where owner_id=$1",
          [alice],
        )
      ).affectedRows,
    ).toBe(0);
    await expect(
      db.query(
        "insert into public.user_workspaces(owner_id,payload) values($1,$2::jsonb)",
        [alice, JSON.stringify(seed())],
      ),
    ).rejects.toThrow(/row-level security/);
    await db.query("select public.load_or_create_workspace($1::jsonb)", [
      JSON.stringify(seed()),
    ]);
    expect(
      (await db.query("select owner_id from public.user_workspaces")).rows,
    ).toEqual([{ owner_id: bob }]);
  });
  it("keeps OAuth tokens server-only and inbox rows private", async () => {
    await db.exec("reset role;");
    await db.query(
      "insert into public.reservation_inbox(owner_id,provider,source_message_id,source_url,candidate) values($1,'Booking.com','m1','https://mail.google.com/', '{}'::jsonb)",
      [alice],
    );
    await asUser(bob);
    expect(
      (await db.query("select * from public.reservation_inbox")).rows,
    ).toHaveLength(0);
    await expect(
      db.query("select * from public.gmail_connections"),
    ).rejects.toThrow(/permission denied/);
    await expect(
      db.query("select * from public.gmail_oauth_states"),
    ).rejects.toThrow(/permission denied/);
    await expect(
      db.query(
        "select public.commit_reservation_import($1,'00000000-0000-4000-8000-000000000000','x','{}'::jsonb)",
        [bob],
      ),
    ).rejects.toThrow(/permission denied/);
    await asUser(alice);
    expect(
      (await db.query("select * from public.reservation_inbox")).rows,
    ).toHaveLength(1);
    await expect(
      db.query("update public.reservation_inbox set status='ignored'"),
    ).rejects.toThrow(/permission denied/);
  });
  it("merges imported stays atomically, preserves payments, and rejects a repeated import", async () => {
    await db.exec("reset role;");
    const imported = await db.query<{ id: string }>(
      "select id from public.reservation_inbox where source_message_id='m1'",
    );
    const id = imported.rows[0].id;
    const booking = {
      id: "imported",
      title: "Imported stay",
      status: "Booked",
      notes: "",
      bookingSource: "Booking.com",
      reference: "REF1234",
      amount: 100,
      paid: 40,
    };
    await db.query(
      "select public.commit_reservation_import($1,$2,$3,$4::jsonb)",
      [alice, id, "guatemala-baja-2027", JSON.stringify(booking)],
    );
    await expect(
      db.query("select public.commit_reservation_import($1,$2,$3,$4::jsonb)", [
        alice,
        id,
        "guatemala-baja-2027",
        JSON.stringify(booking),
      ]),
    ).rejects.toThrow("no longer available");
    const second = await db.query<{ id: string }>(
      "insert into public.reservation_inbox(owner_id,provider,source_message_id,source_url,candidate) values($1,'Booking.com','m2','https://mail.google.com/', '{}'::jsonb) returning id",
      [alice],
    );
    await db.query(
      "select public.commit_reservation_import($1,$2,$3,$4::jsonb)",
      [
        alice,
        second.rows[0].id,
        "guatemala-baja-2027",
        JSON.stringify({
          id: "different-id",
          title: "Amended stay",
          bookingSource: "Booking.com",
          reference: "REF1234",
          status: "Cancelled",
        }),
      ],
    );
    await asUser(alice);
    const result = await db.query<{ payload: ReturnType<typeof seed> }>(
      "select payload from public.user_workspaces",
    );
    const rows = result.rows[0].payload.records[
      "guatemala-baja-2027"
    ].bookings.filter((b) => b.reference === "REF1234");
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe("imported");
    expect(rows[0].paid).toBe(40);
    expect(rows[0].status).toBe("Cancelled");
  });
  it("denies anonymous access to table and RPCs", async () => {
    await db.exec("reset role;set role anon;");
    await expect(
      db.query("select * from public.user_workspaces"),
    ).rejects.toThrow(/permission denied/);
    await expect(
      db.query("select public.load_or_create_workspace($1::jsonb)", [
        JSON.stringify(seed()),
      ]),
    ).rejects.toThrow(/permission denied/);
  });
});
