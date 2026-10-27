import { test, expect } from "@playwright/test";
import { State, kinds } from "../../lib/model";
let original: State;
const tile =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jN3sAAAAASUVORK5CYII=";
test.beforeEach(async ({ page, request }) => {
  original = await (await request.get("/api/state")).json();
  const id = "map-test-" + Date.now();
  const r = structuredClone(original.records[original.activeId]);
  for (const k of kinds) r[k] = [];
  r.destinations = [
    {
      id: "antigua",
      title: "Antigua",
      country: "Guatemala",
      status: "tentative",
      notes: "",
      mapLat: 14.56,
      mapLng: -90.73,
    },
    {
      id: "atitlan",
      title: "Lake Atitlán",
      country: "Guatemala",
      status: "tentative",
      notes: "",
      mapLat: 14.69,
      mapLng: -91.27,
    },
    {
      id: "lapaz",
      title: "La Paz",
      country: "Mexico",
      status: "tentative",
      notes: "",
      mapLat: 24.14,
      mapLng: -110.31,
    },
  ];
  r.segments = r.destinations.map((d, i) => ({
    id: "s" + i,
    title: d.title,
    status: "tentative",
    notes: "",
    destinationId: d.id,
  }));
  r.transport = [
    {
      id: "drive",
      title: "Test road connection",
      status: "tentative",
      notes: "",
      type: "Car",
      fromDestinationId: "antigua",
      toDestinationId: "atitlan",
    },
    {
      id: "fly",
      title: "Test flight connection",
      status: "tentative",
      notes: "",
      type: "Flight",
      fromDestinationId: "atitlan",
      toDestinationId: "lapaz",
    },
    {
      id: "boat",
      title: "Test ferry connection",
      status: "tentative",
      notes: "",
      type: "Ferry",
      fromDestinationId: "lapaz",
      toDestinationId: "antigua",
    },
  ];
  r.bookings = [
    {
      id: "hostel",
      title: "Test hostel reservation",
      propertyName: "Map Test Hostel",
      bookingSource: "Hostelworld",
      status: "Booked",
      notes: "",
      category: "Accommodation",
      stayAddress: "Test address, Antigua, Guatemala",
      date: "2027-04-17",
      end: "2027-04-20",
    },
  ];
  expect(
    (
      await request.put("/api/state", {
        data: {
          ...original,
          activeId: id,
          expeditions: [
            ...original.expeditions,
            { ...original.expeditions[0], id, title: "Map integration test" },
          ],
          records: { ...original.records, [id]: r },
        },
      })
    ).ok(),
  ).toBe(true);
  await page.addInitScript(() => localStorage.setItem("adventure-lang", "en"));
  await page.route("https://tile.openstreetmap.org/**", (route) =>
    route.fulfill({
      body: Buffer.from(tile, "base64"),
      contentType: "image/png",
    }),
  );
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
test("map renders dotted travel icons, a road route and a persisted accommodation popup", async ({
  page,
  request,
}) => {
  await page.route("https://router.project-osrm.org/**", (route) =>
    route.fulfill({
      json: {
        code: "Ok",
        waypoints: [{ distance: 5 }, { distance: 5 }],
        routes: [
          {
            distance: 89000,
            duration: 7200,
            geometry: {
              coordinates: [
                [-90.73, 14.56],
                [-90.94, 14.61],
                [-91.27, 14.69],
              ],
            },
          },
        ],
      },
    }),
  );
  await page.route("https://nominatim.openstreetmap.org/**", (route) =>
    route.fulfill({
      json: [
        {
          display_name: "Map Test Hostel, Antigua, Guatemala",
          lat: "14.559",
          lon: "-90.731",
        },
      ],
    }),
  );
  await page.goto("/");
  await page
    .locator("nav")
    .getByRole("button", { name: "Itinerary", exact: true })
    .click();
  await expect(page.locator(".leaflet-container")).toBeVisible();
  await expect(page.locator("[data-mode=flight]")).toHaveCount(1);
  await expect(page.locator("[data-mode=ferry]")).toHaveCount(1);
  await expect(
    page.getByText("Finding road routes…", { exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".leaflet-overlay-pane path")).toHaveCount(3);
  const hostel = page
    .locator(".map-location-row")
    .filter({ hasText: "Map Test Hostel" });
  await page.getByText("Map locations", { exact: false }).first().click();
  await hostel.getByRole("button", { name: "Search", exact: true }).click();
  await page
    .getByRole("button", { name: /Map Test Hostel, Antigua, Guatemala/ })
    .click();
  await expect(page.locator(".stay-pin")).toHaveCount(1);
  await page.locator(".stay-pin").hover();
  const popup = page.locator(".map-booking-popup");
  await expect(
    popup.getByRole("heading", { name: "Map Test Hostel" }),
  ).toBeVisible();
  await expect(popup.getByText("Hostelworld", { exact: true })).toBeVisible();
  await expect(
    popup.getByText("Test address, Antigua, Guatemala", { exact: true }),
  ).toBeVisible();
  const state = await (await request.get("/api/state")).json();
  expect(state.records[state.activeId].bookings[0].mapLat).toBe(14.559);
  await page.reload();
  await page
    .locator("nav")
    .getByRole("button", { name: "Itinerary", exact: true })
    .click();
  await expect(page.locator(".stay-pin")).toHaveCount(1);
  await page.screenshot({
    path: "test-results/route-map-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.locator(".stay-pin").click();
  await expect(
    page
      .locator(".map-booking-popup")
      .getByRole("heading", { name: "Map Test Hostel" }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator(".sidebar")
        .evaluate((el) => el.getBoundingClientRect().right <= 0),
    )
    .toBe(true);
  await expect
    .poll(async () => {
      const popup = await page.locator(".leaflet-popup").boundingBox(),
        map = await page.locator(".leaflet-container").boundingBox();
      return (
        !!popup &&
        !!map &&
        popup.x >= map.x - 1 &&
        popup.x + popup.width <= map.x + map.width + 1
      );
    })
    .toBe(true);
  await page.screenshot({
    animations: "disabled",
    path: "test-results/route-map-mobile.png",
    fullPage: true,
  });
});
test("routing failures are labeled and manual pin placement needs no geocoding", async ({
  page,
  request,
}) => {
  await page.route("https://router.project-osrm.org/**", (route) =>
    route.fulfill({ status: 503, body: "Unavailable" }),
  );
  let geocodeCalls = 0;
  await page.route("https://nominatim.openstreetmap.org/**", (route) => {
    geocodeCalls++;
    return route.abort();
  });
  await page.goto("/");
  await page
    .locator("nav")
    .getByRole("button", { name: "Itinerary", exact: true })
    .click();
  await expect(page.getByText(/Road routing unavailable for/)).toBeVisible();
  await page.getByText("Map locations", { exact: false }).first().click();
  const row = page
    .locator(".map-location-row")
    .filter({ hasText: "Map Test Hostel" });
  await row.getByRole("button", { name: "Place pin", exact: true }).click();
  await page
    .locator(".leaflet-container")
    .click({ position: { x: 130, y: 160 } });
  await expect(page.locator(".stay-pin")).toHaveCount(1);
  expect(geocodeCalls).toBe(0);
  const state = await (await request.get("/api/state")).json();
  expect(state.records[state.activeId].bookings[0].mapSource).toBe(
    "Manual map pin",
  );
});
