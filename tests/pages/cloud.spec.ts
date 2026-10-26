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
