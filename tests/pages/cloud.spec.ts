import { test, expect } from "@playwright/test";
import { seed } from "../../lib/seed";
const project = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const owner = "11111111-1111-4111-8111-111111111111";
const session = {
  access_token: "test-session-not-a-real-token",
  refresh_token: "test-refresh",
  token_type: "bearer",
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  expires_in: 3600,
  user: {
    id: owner,
    aud: "authenticated",
    role: "authenticated",
    email: "test@example.com",
    created_at: "2026-01-01T00:00:00Z",
    app_metadata: {},
    user_metadata: {},
  },
};
test("static subpath loads assets, sends a magic link and keeps data behind sign-in", async ({
  page,
}) => {
  const failures: string[] = [];
  page.on("response", (r) => {
    if (r.url().startsWith("http://127.0.0.1:4173") && r.status() >= 400)
      failures.push(r.url());
  });
  let redirect = "";
  await page.route(`${project}/auth/v1/otp*`, async (route) => {
    redirect =
      new URL(route.request().url()).searchParams.get("redirect_to") || "";
    await route.fulfill({ json: {} });
  });
  await page.goto("./");
  await expect(
    page.getByRole("heading", { name: "המסעות שלך. המקום שלך." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "English" }).click();
  await page.getByLabel("Email address").fill("test@example.com");
  await page.getByRole("button", { name: "Send a sign-in link" }).click();
  await expect(page.getByRole("status")).toContainText("Check your email");
  expect(redirect).toBe(new URL("./", page.url()).href);
  expect(await page.locator(".hero").count()).toBe(0);
  expect(failures).toEqual([]);
});
test("authenticated static site saves and restores synced data, exports backup and signs out", async ({
  page,
}) => {
  let state = seed();
  await page.addInitScript(
    ({ project, session }) => {
      const ref = new URL(project).hostname.split(".")[0];
      localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(session));
      localStorage.setItem("adventure-lang", "en");
    },
    { project, session },
  );
  await page.route(`${project}/rest/v1/rpc/*`, async (route) => {
    const data = route.request().postDataJSON();
    if (route.request().url().endsWith("/save_workspace")) {
      if (data.p_expected_revision !== state.revision) {
        await route.fulfill({
          status: 409,
          json: { code: "PT409", message: "Conflict" },
        });
        return;
      }
      state = { ...data.p_state, revision: state.revision + 1 };
    }
    await route.fulfill({ json: state });
  });
  await page.route(`${project}/auth/v1/logout*`, (route) =>
    route.fulfill({ json: {} }),
  );
  await page.goto("./");
  await expect(page.locator(".hero")).toBeVisible();
  await page
    .locator("nav")
    .getByRole("button", { name: /Preparation/ })
    .click();
  await page.getByRole("button", { name: "Add new" }).click();
  await page.getByLabel("Task", { exact: true }).fill("Synced Pages task");
  await page.getByRole("button", { name: "Save record" }).click();
  await expect(
    page.getByRole("button", { name: "Synced Pages task", exact: true }),
  ).toBeVisible();
  await page.reload();
  await page
    .locator("nav")
    .getByRole("button", { name: /Preparation/ })
    .click();
  await expect(
    page.getByRole("button", { name: "Synced Pages task", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Expedition settings", exact: true })
    .click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export full backup" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("adventure-os-backup.json");
  expect(state.records[state.activeId].tasks.at(-1)?.title).toBe(
    "Synced Pages task",
  );
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "המסעות שלך. המקום שלך." }),
  ).toBeVisible();
  expect(await page.locator(".hero").count()).toBe(0);
  expect(
    await page.evaluate(() => localStorage.getItem("adventure-cache")),
  ).toBeNull();
});
test("mobile sign-in has no horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./");
  await expect(
    page.getByRole("heading", { name: "המסעות שלך. המקום שלך." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("reservation review imports into the selected destination and refreshes the workspace", async ({
  page,
}) => {
  const state = seed();
  let imported = false;
  let integrationRequests = 0;
  const candidate = {
    id: "pending",
    title: "Reviewed hostel",
    status: "Booked",
    notes: "Imported confirmation",
    date: "2027-04-17",
    end: "2027-04-20",
    stayAddress: "Calle 5, Antigua, Guatemala",
    bookingSource: "Booking.com",
    reference: "TEST1234",
    category: "Accommodation",
    cancellationVerified: false,
  };
  await page.addInitScript(
    ({ project, session }) => {
      const ref = new URL(project).hostname.split(".")[0];
      localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(session));
      localStorage.setItem("adventure-lang", "en");
    },
    { project, session },
  );
  await page.route(`${project}/rest/v1/rpc/*`, (route) =>
    route.fulfill({ json: state }),
  );
  await page.route(`${project}/rest/v1/reservation_inbox*`, (route) =>
    route.fulfill({
      json: imported
        ? []
        : [
            {
              id: "review-1",
              provider: "Booking.com",
              source_url: "https://mail.google.com/mail/",
              candidate,
              status: "review",
            },
          ],
    }),
  );
  await page.route(`${project}/functions/v1/gmail-connect`, async (route) => {
    integrationRequests++;
    const data = route.request().postDataJSON();
    if (data.action === "apply") {
      expect(data.destinationId).toBe("antigua");
      state.records[state.activeId].bookings.push({
        ...candidate,
        id: "imported-review",
        destinationId: "antigua",
      });
      state.revision++;
      imported = true;
      await route.fulfill({ json: { ok: true } });
    } else
      await route.fulfill({
        json: { connected: true, email: "test@example.com" },
      });
  });
  await page.goto("./");
  await page
    .locator("nav")
    .getByRole("button", { name: "Reservation sync", exact: true })
    .click();
  expect(integrationRequests).toBe(0);
  await expect(
    page.getByRole("heading", { name: "In-app cancellation notifications" }),
  ).toBeVisible();
  await page
    .getByText("Optional: connect Google / Gmail for reservation imports", {
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", { name: "Reviewed hostel" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Import into this expedition" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Reviewed hostel" }),
  ).toHaveCount(0);
  await page
    .locator("nav")
    .getByRole("button", { name: "Bookings", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Reviewed hostel", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Calle 5, Antigua, Guatemala", { exact: true }),
  ).toBeVisible();
});
test("static Pages map loads its Leaflet bundle below the repository base path", async ({
  page,
}) => {
  const state = seed();
  const r = state.records[state.activeId];
  r.destinations = r.destinations.slice(0, 2).map((d, i) => ({
    ...d,
    mapLat: 14.55 + i * 0.13,
    mapLng: -90.73 - i * 0.4,
  }));
  r.transport = [
    {
      id: "static-flight",
      title: "Static test flight",
      status: "tentative",
      notes: "",
      type: "Flight",
      fromDestinationId: r.destinations[0].id,
      toDestinationId: r.destinations[1].id,
    },
  ];
  r.segments = [];
  await page.addInitScript(
    ({ project, session }) => {
      const ref = new URL(project).hostname.split(".")[0];
      localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(session));
      localStorage.setItem("adventure-lang", "en");
    },
    { project, session },
  );
  await page.route(`${project}/rest/v1/rpc/*`, (route) =>
    route.fulfill({ json: state }),
  );
  await page.route("https://tile.openstreetmap.org/**", (route) =>
    route.fulfill({
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jN3sAAAAASUVORK5CYII=",
        "base64",
      ),
      contentType: "image/png",
    }),
  );
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./");
  await page
    .locator("nav")
    .getByRole("button", { name: "Itinerary", exact: true })
    .click();
  await expect(page.locator(".leaflet-container")).toBeVisible();
  await expect(page.locator("[data-mode=flight]")).toHaveCount(1);
  expect(errors).toEqual([]);
});
test("invalid stored expedition references offer a backup and confirmed lossless repair after login", async ({
  page,
}) => {
  let state = seed();
  const savedRecords = structuredClone(state.records[state.activeId]);
  state.expeditions[0].id = "changed-expedition-id";
  await page.addInitScript(
    ({ project, session }) => {
      const ref = new URL(project).hostname.split(".")[0];
      localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(session));
      localStorage.setItem("adventure-lang", "en");
    },
    { project, session },
  );
  let saves = 0;
  await page.route(`${project}/rest/v1/rpc/*`, async (route) => {
    if (route.request().url().endsWith("/save_workspace")) {
      saves++;
      const input = route.request().postDataJSON();
      expect(input.p_expected_revision).toBe(0);
      state = { ...input.p_state, revision: 1 };
    }
    await route.fulfill({ json: state });
  });
  await page.goto("./");
  await expect(
    page.getByRole("heading", { name: "Reconnect your expedition records" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Confirm repair", exact: true }),
  ).toBeDisabled();
  expect(saves).toBe(0);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download original backup" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(
    "adventure-os-original-before-repair.json",
  );
  await page
    .getByRole("button", { name: "Confirm repair", exact: true })
    .click();
  await expect(page.locator(".hero")).toBeVisible();
  expect(saves).toBe(1);
  expect(state.activeId).toBe("changed-expedition-id");
  expect(state.records["changed-expedition-id"]).toEqual(savedRecords);
  await page.reload();
  await expect(page.locator(".hero")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Reconnect your expedition records" }),
  ).toHaveCount(0);
});
