import { test, expect } from "@playwright/test";
import { State, kinds } from "../../lib/model";
let original: State;
test.beforeEach(async ({ request, page }) => {
  original = await (await request.get("/api/state")).json();
  const id = "test-expedition-" + Date.now();
  const source = structuredClone(original.records[original.activeId]);
  for (const k of kinds) source[k] = [];
  const next = {
    ...original,
    activeId: id,
    expeditions: [
      ...original.expeditions,
      { ...original.expeditions[0], id, title: "Integration expedition" },
    ],
    records: { ...original.records, [id]: source },
  };
  expect((await request.put("/api/state", { data: next })).ok()).toBe(true);
  await page.addInitScript(() => localStorage.setItem("adventure-lang", "en"));
  await page.goto("/");
  await expect(page.locator(".hero")).toBeVisible();
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
test("booking costs, gear packing and actual dive log survive reload", async ({
  page,
  request,
}) => {
  await page
    .locator("nav")
    .getByRole("button", { name: "Bookings", exact: true })
    .click();
  await page.getByRole("button", { name: "Add new", exact: true }).click();
  await page.getByLabel("Booking name", { exact: true }).fill("Test excursion");
  await page
    .getByLabel("Booking status", { exact: true })
    .selectOption("Booked");
  await page.getByLabel("Total / estimated cost", { exact: true }).fill("7000");
  await page.getByLabel("Currency", { exact: true }).selectOption("MXN");
  await page
    .getByLabel("Total payments so far (original currency)", { exact: true })
    .fill("2000");
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Test excursion", exact: true }),
  ).toBeVisible();
  await page
    .locator("nav")
    .getByRole("button", { name: "Gear & packing", exact: true })
    .click();
  await page.getByRole("button", { name: "Add new", exact: true }).click();
  await page.getByLabel("Item", { exact: true }).fill("Test headlamp");
  await page.getByLabel("Ownership", { exact: true }).selectOption("owned");
  await page
    .getByLabel("Include in expedition packing", { exact: true })
    .check();
  await page.getByLabel("Packed", { exact: true }).check();
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Test headlamp", exact: true }),
  ).toBeVisible();
  await page
    .locator("nav")
    .getByRole("button", { name: "Dive & trek log", exact: true })
    .click();
  await page.getByRole("button", { name: "Add new", exact: true }).click();
  await page
    .getByLabel("Dive location", { exact: true })
    .fill("Test refresher");
  await page.getByLabel("Status", { exact: true }).selectOption("Completed");
  await page.getByLabel("Dive date", { exact: true }).fill("2027-03-14");
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  await expect(
    page.getByText("1 actual logged dives", { exact: true }),
  ).toBeVisible();
  await page.reload();
  const s = await (await request.get("/api/state")).json();
  const r = s.records[s.activeId];
  expect(r.bookings[0].amount).toBe(7000);
  expect(r.gear[0].packed).toBe(true);
  expect(r.dives[0].date).toBe("2027-03-14");
  const backup = await (await request.get("/api/backup")).json();
  expect(backup.records[s.activeId].gear[0].title).toBe("Test headlamp");
});
test("date changes surface a confirmed booking without moving it", async ({
  page,
  request,
}) => {
  const s: State = await (await request.get("/api/state")).json();
  const r = s.records[s.activeId];
  r.destinations = [
    { id: "place", title: "Test destination", status: "tentative", notes: "" },
  ];
  r.segments = [
    {
      id: "segment",
      title: "Test stay",
      status: "tentative",
      notes: "",
      destinationId: "place",
      date: "2027-04-20",
      end: "2027-04-24",
    },
  ];
  r.bookings = [
    {
      id: "booking",
      title: "Confirmed hostel",
      status: "Booked",
      notes: "",
      destinationId: "place",
      date: "2027-04-20",
      end: "2027-04-24",
    },
  ];
  expect((await request.put("/api/state", { data: s })).ok()).toBe(true);
  await page.reload();
  await page
    .locator("nav")
    .getByRole("button", { name: "Itinerary", exact: true })
    .click();
  await page.getByRole("button", { name: "Test stay", exact: true }).click();
  await page.getByLabel("Start date", { exact: true }).fill("2027-04-17");
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await expect(
    page.getByRole("alertdialog").getByText("Confirmed hostel"),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Confirm this change only", exact: true })
    .click();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  const updated = await (await request.get("/api/state")).json();
  expect(updated.records[s.activeId].bookings[0].date).toBe("2027-04-20");
  expect(updated.records[s.activeId].segments[0].date).toBe("2027-04-17");
});
test("API rejects stale writes and invalid backup data", async ({
  request,
}) => {
  const s = await (await request.get("/api/state")).json();
  expect((await request.put("/api/state", { data: s })).ok()).toBe(true);
  expect((await request.put("/api/state", { data: s })).status()).toBe(409);
  expect(
    (
      await request.put("/api/state", { data: { ...s, activeId: "missing" } })
    ).status(),
  ).toBe(400);
});
