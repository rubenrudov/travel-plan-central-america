import { test, expect } from "@playwright/test";
import type { State } from "../../lib/model";
let original: State;
let expeditionId: string;
test.beforeEach(async ({ page, request }) => {
  original = await (await request.get("/api/state")).json();
  expeditionId = `nature-qa-${Date.now()}`;
  const records = structuredClone(original.records[original.activeId]);
  records.bookings.push({
    id: "qa-confirmed",
    title: "לינת בדיקה מאושרת",
    notes: "נתון בדיקה בלבד",
    status: "Refundable booking",
    reference: "QA-ONLY",
    category: "Accommodation",
    destinationId: "pulmo",
    date: "2027-05-16",
    end: "2027-05-19",
    amount: 500,
    paid: 100,
    currency: "ILS",
  });
  expect(
    (
      await request.put("/api/state", {
        data: {
          ...original,
          activeId: expeditionId,
          expeditions: [
            ...original.expeditions,
            { ...original.expeditions[0], id: expeditionId },
          ],
          records: { ...original.records, [expeditionId]: records },
        },
      })
    ).ok(),
  ).toBe(true);
  await page.addInitScript(() => localStorage.setItem("adventure-lang", "he"));
  await page.goto("/");
  await expect(page.locator(".trip-now")).toBeVisible();
});
test.afterEach(async ({ request }) => {
  const current = await (await request.get("/api/state")).json();
  expect(
    (
      await request.put("/api/state", {
        data: { ...original, revision: current.revision },
      })
    ).ok(),
  ).toBe(true);
});
test("Hebrew booking windows, completion and postponement persist after refresh", async ({
  page,
  request,
}) => {
  await page
    .locator("nav")
    .getByRole("button", { name: "מרכז ההזמנות", exact: true })
    .click();
  await expect(page.locator(".trip-window")).toHaveCount(4);
  await expect(page.locator(".trip-window .trip-task")).toHaveCount(27);
  const flight = page
    .locator(".trip-task")
    .filter({ hasText: "לאמת פרטי טיסות בינלאומיות ואישורים" });
  await flight
    .getByRole("button", { name: "סימון השלמה", exact: true })
    .click();
  await expect(
    flight.getByRole("button", { name: "סימון השלמה" }),
  ).toBeDisabled();
  const lodging = page
    .locator(".trip-task")
    .filter({ hasText: "לבדוק אישורי לינה באנטיגואה ובאטיטלן" });
  await lodging.getByLabel(/^דחייה:/).fill("2027-01-20");
  await expect(lodging.getByLabel(/^סטטוס:/)).toHaveValue("Deferred");
  await page.reload();
  await page
    .locator("nav")
    .getByRole("button", { name: "מרכז ההזמנות", exact: true })
    .click();
  await expect(flight.getByLabel(/^סטטוס:/)).toHaveValue("Done");
  await expect(lodging.getByLabel(/^דחייה:/)).toHaveValue("2027-01-20");
  const saved: State = await (await request.get("/api/state")).json();
  expect(
    saved.records[expeditionId].bookings.find((b) => b.id === "qa-confirmed")
      ?.paid,
  ).toBe(100);
});
test("mobile date move updates recommendations and preserves the confirmed reservation", async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "Open navigation", exact: true })
    .click();
  await page
    .locator("nav")
    .getByRole("button", { name: "מסלול הטיול", exact: true })
    .click();
  await expect(page.locator(".trip-day")).toHaveCount(34);
  const station = page.locator(".trip-station").filter({
    has: page.getByRole("button", {
      name: "עריכת תחנה: קאבו פולמו",
      exact: true,
    }),
  });
  await station
    .getByLabel("תחילת תחנה: קאבו פולמו", { exact: true })
    .fill("2027-05-15");
  await station
    .getByRole("button", { name: "בדיקת הזזת תחנה", exact: true })
    .click();
  await page
    .getByRole("button", { name: "אישור שינוי התחנה בלבד", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "בדיקת שינוי מסלול" }),
  ).toHaveCount(0);
  await page.reload();
  const saved: State = await (await request.get("/api/state")).json();
  const r = saved.records[expeditionId];
  expect(r.segments.find((s) => s.id === "nature27-stop-pulmo")?.date).toBe(
    "2027-05-15",
  );
  expect(r.tasks.find((t) => t.id === "nature27-task-pulmo-book")?.date).toBe(
    "2027-03-24",
  );
  expect(r.bookings.find((b) => b.id === "qa-confirmed")).toMatchObject({
    date: "2027-05-16",
    end: "2027-05-19",
    reference: "QA-ONLY",
    paid: 100,
  });
});
test("marine profile and category budgets save without inventing logged dives", async ({
  page,
  request,
}) => {
  await page
    .locator("nav")
    .getByRole("button", { name: "הרפתקאות ימיות", exact: true })
    .click();
  await expect(page.locator(".trip-marine-card")).toHaveCount(5);
  await page
    .getByLabel("ניסיון והכנות", { exact: true })
    .fill("צלילת רענון מתוכננת בישראל; המספר הכולל דורש בדיקה");
  await page
    .getByRole("button", { name: "שמירת פרופיל הצלילה", exact: true })
    .click();
  await page
    .locator("nav")
    .getByRole("button", { name: "תקציב והוצאות", exact: true })
    .click();
  await page.getByLabel("רזרבה בש״ח", { exact: true }).fill("1500");
  await page.getByLabel("יעד תקציב: צלילות", { exact: true }).fill("3000");
  await page
    .getByRole("button", { name: "שמירת רזרבה ותקציבי משנה", exact: true })
    .click();
  await expect(page.locator(".trip-budget-lines")).toContainText("1,500");
  await page.reload();
  const saved: State = await (await request.get("/api/state")).json();
  expect(saved.expeditions.find((e) => e.id === expeditionId)).toMatchObject({
    reserve: 1500,
    categoryBudgets: { צלילות: 3000 },
    currentExperience: "צלילת רענון מתוכננת בישראל; המספר הכולל דורש בדיקה",
  });
  expect(saved.records[expeditionId].dives).toEqual(
    original.records[original.activeId].dives,
  );
});

test("desktop drag previews a flexible station move before committing dates", async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page
    .locator("nav")
    .getByRole("button", { name: "מסלול הטיול", exact: true })
    .click();
  const station = page.locator(".trip-station").filter({
    has: page.getByRole("button", {
      name: "עריכת תחנה: קאבו פולמו",
      exact: true,
    }),
  });
  const target = page.locator(".trip-day").filter({
    has: page.getByRole("heading", { name: "15 במאי", exact: true }),
  });
  await target.scrollIntoViewIfNeeded();
  await station
    .getByRole("button", { name: "גרירת תחנה ליומן: קאבו פולמו", exact: true })
    .dragTo(target);
  await expect(
    page.getByRole("region", { name: "בדיקת שינוי מסלול" }),
  ).toBeVisible();
  const before: State = await (await request.get("/api/state")).json();
  expect(
    before.records[expeditionId].segments.find(
      (s) => s.id === "nature27-stop-pulmo",
    )?.date,
  ).toBe("2027-05-16");
  await page
    .getByRole("button", { name: "אישור שינוי התחנה בלבד", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "בדיקת שינוי מסלול" }),
  ).toHaveCount(0);
  const after: State = await (await request.get("/api/state")).json();
  expect(
    after.records[expeditionId].segments.find(
      (s) => s.id === "nature27-stop-pulmo",
    )?.date,
  ).toBe("2027-05-15");
  expect(after.records[expeditionId].bookings).toEqual(
    before.records[expeditionId].bookings,
  );
});

test("station and flight editors retain the new planning statuses", async ({
  page,
}) => {
  await page
    .locator("nav")
    .getByRole("button", { name: "תחבורה ומעברים", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "טיסה: גואטמלה סיטי → מקסיקו סיטי",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("dialog").getByLabel("מצב", { exact: true }),
  ).toHaveValue("Planned booking");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page
    .locator("nav")
    .getByRole("button", { name: "מסלול הטיול", exact: true })
    .click();
  await page
    .getByRole("button", { name: "עריכת תחנה: אנטיגואה", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").getByLabel("מצב", { exact: true }),
  ).toHaveValue("Planned");
  await page.getByRole("button", { name: "Close", exact: true }).click();
});
