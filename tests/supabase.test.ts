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
      `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;insert into auth.users values ('${alice}'),('${bob}');`,
    );
    await db.exec(
      readFileSync("supabase/migrations/202610260001_workspaces.sql", "utf8"),
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
