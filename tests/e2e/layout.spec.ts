import { test, expect } from "@playwright/test";

for (const lang of ["en", "he"] as const) {
  test(`${lang}: navigation and record controls fit phone, tablet and desktop`, async ({
    page,
  }) => {
    await page.addInitScript(
      (language) => localStorage.setItem("adventure-lang", language),
      lang,
    );
    await page.goto("/");
    await expect(page.locator(".hero")).toBeVisible();
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      for (const index of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
        if (width <= 700) {
          await page
            .getByRole("button", { name: "Open navigation", exact: true })
            .click();
        }
        await page.locator(".sidebar nav button").nth(index).click();
        await expect(
          page.locator(".sidebar nav button").nth(index),
        ).toHaveAttribute("aria-current", "page");
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        expect(
          await page.locator("main .icon-button").evaluateAll((buttons) =>
            buttons.every((button) => {
              const box = button.getBoundingClientRect();
              const icon = button.querySelector("svg")?.getBoundingClientRect();
              return (
                !icon ||
                (icon.left >= box.left &&
                  icon.right <= box.right &&
                  icon.top >= box.top &&
                  icon.bottom <= box.bottom)
              );
            }),
          ),
        ).toBe(true);
      }
    }
    await page.setViewportSize({ width: 320, height: 568 });
    const opener = page.getByRole("button", {
      name: "Open navigation",
      exact: true,
    });
    await opener.click();
    await page.locator(".settings-button").scrollIntoViewIfNeeded();
    await expect(page.locator(".settings-button")).toBeInViewport();
    await page.keyboard.press("Escape");
    await expect(opener).toBeFocused();
    await expect(opener).toHaveAttribute("aria-expanded", "false");
  });
}

test("mobile editor keeps close/save controls reachable and errors inside the dialog", async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem("adventure-lang", "en"));
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/");
  await expect(page.locator(".hero")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "View itinerary" }),
  ).toBeVisible();
  await expect(page.locator(".destination-card")).toHaveCount(7);
  for (const card of await page.locator(".destination-card").all())
    await expect(card).toBeVisible();
  await page
    .getByRole("button", { name: "Open navigation", exact: true })
    .click();
  await page
    .locator("nav")
    .getByRole("button", { name: "Bookings", exact: true })
    .click();
  await page.getByRole("button", { name: "Add new", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("button", { name: "Close", exact: true }),
  ).toBeInViewport();
  await dialog
    .getByLabel("Booking name", { exact: true })
    .fill("Layout validation only");
  await dialog.getByLabel("Start date", { exact: true }).fill("2027-05-10");
  await dialog.getByLabel("End date", { exact: true }).fill("2027-05-01");
  await dialog
    .getByRole("button", { name: "Save record", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText(
    "End must follow start date",
  );
  await expect(dialog.getByRole("alert")).toBeInViewport();
  expect(await dialog.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(
    true,
  );
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Add new", exact: true }),
  ).toBeFocused();
});
