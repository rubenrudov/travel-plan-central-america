import { State, Entry, Kind, kinds } from "./model";
const entry = (
  id: string,
  title: string,
  extra: Record<string, string | number | boolean | string[]> = {},
): Entry => ({ id, title, status: "tentative", notes: "", ...extra });
export function emptyRecords() {
  return Object.fromEntries(kinds.map((k) => [k, [] as Entry[]])) as Record<
    Kind,
    Entry[]
  >;
}
export function seed(): State {
  const r = emptyRecords();
  r.destinations = [
    entry("antigua", "Antigua", {
      country: "Guatemala",
      notes: "Culture, social hostels & acclimatization",
      color: "terra",
    }),
    entry("acatenango", "Acatenango", {
      country: "Guatemala",
      notes:
        "3,976 m • overnight guided trek. Plan acclimatization separately from fitness.",
    }),
    entry("atitlan", "Lake Atitlán", {
      country: "Guatemala",
      notes: "San Pedro La Laguna • slow mornings & village explorations",
    }),
    entry("lapaz", "La Paz", {
      country: "Mexico",
      notes:
        "Base for mobula day trips & Espíritu Santo. Sightings never guaranteed.",
    }),
    entry("pulmo", "Cabo Pulmo", {
      country: "Mexico",
      notes:
        "Dive conditions and operator experience requirements need verification.",
    }),
    entry("cdmx", "Mexico City", {
      country: "Mexico",
      notes: "Return departure May 20. Plan a connection buffer.",
    }),
  ];
  r.segments = [
    entry("s1", "Arrive & find your rhythm", {
      destinationId: "antigua",
      date: "2027-04-17",
      end: "2027-04-21",
      type: "Stay",
      notes: "Illustrative dates only. Airport transfer and hostel unbooked.",
    }),
    entry("s2", "Above the clouds", {
      destinationId: "acatenango",
      date: "2027-04-21",
      end: "2027-04-23",
      type: "Activity",
      notes:
        "Draft overnight trek with recovery day. Confirm operator inclusions.",
    }),
    entry("s3", "Life by the lake", {
      destinationId: "atitlan",
      date: "2027-04-23",
      end: "2027-04-30",
      type: "Stay",
    }),
    entry("s4", "Follow the mobulas", {
      destinationId: "lapaz",
      date: "2027-04-30",
      end: "2027-05-12",
      type: "Stay",
      notes: "Draft transition date; leave weather contingency days.",
    }),
    entry("s5", "Beneath the surface", {
      destinationId: "pulmo",
      date: "2027-05-12",
      end: "2027-05-17",
      type: "Activity",
      notes:
        "Schedule diving-to-flight surface interval with operator guidance.",
    }),
    entry("s6", "A little room to breathe", {
      destinationId: "cdmx",
      date: "2027-05-17",
      end: "2027-05-20",
      type: "Buffer",
    }),
  ];
  r.bookings = [
    entry("b1", "International flights", {
      category: "Flights",
      status: "Researching",
      paymentStatus: "Unknown",
      notes:
        "Discussed/booked externally. Enter actual status, routing, confirmation and amounts; none assumed.",
    }),
    entry("b2", "Antigua hostel", {
      category: "Accommodation",
      status: "Researching",
      destinationId: "antigua",
    }),
    entry("b3", "Acatenango overnight trek", {
      category: "Trekking",
      status: "Researching",
      destinationId: "acatenango",
      dependencies: ["b2"],
    }),
    entry("b4", "Mobula day excursion", {
      category: "Wildlife excursions",
      status: "Idea",
      destinationId: "lapaz",
      currency: "MXN",
      notes:
        "Planning ceiling MXN 7,000/day; not a quote. No amount committed.",
    }),
  ];
  const tasks = [
    ["Passport validity", "Documents", "Now"],
    ["Guatemala entry requirements — Israeli passport", "Documents", "Now"],
    ["Mexico entry requirements — Israeli passport", "Documents", "Now"],
    ["Transit country requirements", "Documents", "Before booking"],
    [
      "Insurance & evacuation / hyperbaric coverage",
      "Health",
      "Before booking",
    ],
    ["Travel medicine & vaccination review", "Health", "Now"],
    ["Emergency contacts & document copies", "Documents", "Before departure"],
    ["Choose an Acatenango operator", "Trekking", "Before booking"],
    [
      "Cold layers, rental inclusions & water plan",
      "Trekking",
      "Before departure",
    ],
    ["Gradual training after recovery", "Trekking", "Ongoing"],
    ["Acclimatization & recovery day", "Trekking", "Before booking"],
    ["Certification documents & dive log", "Diving", "Now"],
    ["November / December practice dives", "Diving", "Nov–Dec 2026"],
    ["March refresher & gear inspection", "Diving", "March 2027"],
    ["Check operator experience requirements", "Diving", "Before booking"],
    ["Choose Antigua and San Pedro hostels", "Logistics", "Before booking"],
    ["Compare Guatemala → Baja routing", "Logistics", "Before booking"],
    [
      "Compare mobula operators & cancellation terms",
      "Logistics",
      "Before booking",
    ],
    ["Plan Cabo Pulmo road transfers", "Logistics", "Before booking"],
    ["Mexico City pre-departure buffer", "Logistics", "Before booking"],
    ["Driving licence & rental requirements", "Documents", "Before booking"],
  ];
  r.tasks = tasks.map(([title, category, window], i) =>
    entry("t" + i, title, {
      category,
      window,
      status: "Todo",
      priority: i < 5 ? "High" : "Medium",
      notes: category === "Documents" ? "Requires official verification" : "",
      dependencies: i === 16 ? ["t2"] : [],
    }),
  );
  const legs = [
    ["Guatemala City Airport", "Antigua"],
    ["Antigua", "Acatenango meeting point"],
    ["Antigua", "Lake Atitlán / San Pedro"],
    ["Lake Atitlán", "Guatemala departure airport"],
    ["Guatemala", "Baja California Sur"],
    ["Baja airport", "La Paz"],
    ["La Paz", "Cabo Pulmo"],
    ["Cabo Pulmo", "La Paz or Los Cabos"],
    ["Baja", "Mexico City"],
    ["Mexico City", "Israel"],
  ];
  r.transport = legs.map(([origin, destination], i) =>
    entry("l" + i, `${origin} → ${destination}`, {
      origin,
      destination,
      type: i === 4 || i === 8 || i === 9 ? "Flight" : "Transfer",
      status: "Researching",
      confidence: "Needs verification",
    }),
  );
  r.gear = [
    "Osprey Kestrel 58L backpack",
    "Daypack",
    "GoPro",
    "Sony mirrorless camera",
    "Possible DJI Neo drone",
    "Hiking shoes",
    "Hiking clothes",
    "Cold weather layers",
    "Headlamp",
    "Dry bags",
    "Snorkeling & diving accessories",
    "Travel adapters",
    "Power bank",
    "Tent / sleeping bag / trekking poles",
  ].map((title, i) =>
    entry("g" + i, title, {
      category:
        i < 2
          ? "Backpacking"
          : i < 5
            ? "Photography"
            : i < 9
              ? "Trekking"
              : i === 10
                ? "Scuba diving"
                : "Electronics",
      ownership: "unverified",
      quantity: 1,
      packed: false,
      notes:
        i === 13
          ? "Check trek provider inclusions before buying or renting."
          : "Ownership unverified; discussed item only.",
    }),
  );
  r.decisions = [
    "Which Acatenango operator?",
    "Which Antigua hostel?",
    "Which San Pedro hostel?",
    "Guatemala → Baja: which route?",
    "How many mobula days?",
    "Which La Paz dive operator?",
    "Cabo Pulmo overnight or day trip?",
    "Rent a car or organize transfers?",
    "Buy in Israel or rent locally?",
  ].map((title, i) =>
    entry("d" + i, title, { status: "Open", confidence: "Needs verification" }),
  );
  return {
    version: 1,
    revision: 0,
    activeId: "guatemala-baja-2027",
    expeditions: [
      {
        id: "guatemala-baja-2027",
        title: "Guatemala & Baja — 2027",
        start: "2027-04-17",
        end: "2027-05-20",
        budget: 25000,
        rates: { ILS: 1, USD: 3.7, GTQ: 0.48, MXN: 0.19, EUR: 4 },
      },
    ],
    records: { "guatemala-baja-2027": r },
  };
}
