import { test, expect } from "@playwright/test";
test("Hebrew dashboard, task CRUD and persistent reload", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(
    page.getByRole("heading", { name: "Guatemala & Baja California" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await page
    .getByRole("button", { name: /Preparation/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Add new" }).click();
  await page
    .getByLabel("Task", { exact: true })
    .fill("Smoke test packing task");
  await page.getByRole("button", { name: "Save record" }).click();
  await expect(
    page.getByRole("button", { name: "Smoke test packing task", exact: true }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: /Preparation/ })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Smoke test packing task", exact: true })
    .click();
  await page
    .getByLabel("Task", { exact: true })
    .fill("Updated smoke test task");
  await page.getByRole("button", { name: "Save record" }).click();
  const record = page
    .locator(".record")
    .filter({ hasText: "Updated smoke test task" });
  page.once("dialog", (dialog) => dialog.accept());
  await record.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Updated smoke test task", exact: true }),
  ).toHaveCount(0);
});
test("mobile layout fits viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator(".hero")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: "test-results/desktop.png", fullPage: true });
});
