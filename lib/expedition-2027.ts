import { State, Entry, Kind, kinds, stateSchema, str } from "./model";
import { isExistingBooking } from "./booking-status";
export const PLAN_VERSION = "nature-sea-2027-v1";
export const tripTitle = "גואטמלה ומקסיקו — מסע בעקבות הטבע והים";
const rec = (
  id: string,
  title: string,
  fields: Record<string, string | number | boolean | string[]> = {},
): Entry => ({
  id: `nature27-${id}`,
  title,
  status: "Planned",
  notes: "",
  planVersion: PLAN_VERSION,
  ...fields,
});
const stopData = [
  [
    "antigua",
    "אנטיגואה",
    "Antigua",
    "גואטמלה",
    "2027-04-17",
    "2027-04-20",
    "חקר העיר, שווקים, אוכל ומטיילים. טרק אקטננגו מתוכנן בלבד; יש לברר את מועדו ואת הלילה שבין 20 ל־21 באפריל.",
  ],
  [
    "atitlan",
    "אגם אטיטלן — סן פדרו",
    "Lake Atitlan, Lake Atitlán, San Pedro La Laguna",
    "גואטמלה",
    "2027-04-21",
    "2027-04-24",
    "בסיס סן פדרו בכפוף לאישור ההזמנה. כפרים, שיט, טבע ורכיבה מאורגנת — אפשר להשאיר ספונטני. הצ׳ק־אאוט והלילה האחרון דורשים אימות.",
  ],
  [
    "semuc",
    "סמוק שמפיי — לנקין",
    "Semuc Champey, Lanquin, Lanquín",
    "גואטמלה",
    "2027-04-25",
    "2027-04-28",
    "הצעה ל־2–3 לילות בחלון 25–29 באפריל. בריכות, תצפיות ומערות. זמני המעבר מאטיטלן ולגואטמלה סיטי טרם אומתו.",
  ],
  [
    "cdmx",
    "מקסיקו סיטי",
    "Mexico City, Ciudad de Mexico, CDMX",
    "מקסיקו",
    "2027-04-30",
    "2027-05-04",
    "הצעה ל־3–4 לילות. Roma Norte או Condesa; אוכל, תרבות, היסטוריה ושווקים. הגעה בטיסה מגואטמלה סיטי — לא הוזמנה.",
  ],
  [
    "lapaz",
    "לה פאס",
    "La Paz",
    "מקסיקו",
    "2027-05-04",
    "2027-05-10",
    "צלילות מכלים בים קורטס, Espíritu Santo, דיג ויציאות ימיות. להשאיר ימים לחקר ולשינוי לפי תנאי הים.",
  ],
  [
    "ventana",
    "לה ונטנה / אל סרגנטו",
    "La Ventana, El Sargento",
    "מקסיקו",
    "2027-05-10",
    "2027-05-16",
    "מובולות: יעד של שני ימי ספארי לפחות, בסירה משותפת. יום ראשון לשריון בהמשך; יום שני ספונטני. עד 7,000 MXN ליום כהעדפה, לא הצעת מחיר. מפעיל מורשה וכללי הגנת חיות בר; מפגשים אינם מובטחים.",
  ],
  [
    "pulmo",
    "קאבו פולמו",
    "Cabo Pulmo",
    "מקסיקו",
    "2027-05-16",
    "2027-05-19",
    "פארק ימי מוגן, 2–3 לילות ויעד של ארבע צלילות בשני ימים, בכפוף לניסיון ולים. יש לבדוק גישה ללא רכב ואת מרווח הזמן מהצלילה האחרונה לטיסה ב־19 במאי.",
  ],
  [
    "return",
    "מקסיקו סיטי — לילה לפני החזרה",
    "Mexico City, CDMX",
    "מקסיקו",
    "2027-05-19",
    "2027-05-20",
    "יעד תכנוני: חזרה מבאחה ב־19 במאי ולילה ביטחון לפני הטיסה הבינלאומית ב־20 במאי. פרטי טיסות ואישורים חסרים.",
  ],
];
export const bookingWindows = [
  { id: "now", title: "לסגור עכשיו · נובמבר–דצמבר 2026", date: "2026-12-15" },
  { id: "winter", title: "ינואר–פברואר 2027", date: "2027-02-15" },
  { id: "spring", title: "מרץ–תחילת אפריל 2027", date: "2027-03-25" },
  { id: "spontaneous", title: "ספונטני במהלך המסע", date: "" },
] as const;
const taskData: [string, string, string, number, string?][] = [
  [
    "flights-proof",
    "לאמת פרטי טיסות בינלאומיות ואישורים, אם כבר הוזמנו",
    "return",
    0,
  ],
  [
    "stays-proof",
    "לבדוק אישורי לינה באנטיגואה ובאטיטלן, תאריכים וצ׳ק־אאוט",
    "antigua",
    0,
  ],
  [
    "trek-dates",
    "לבדוק את תאריכי טרק אקטננגו ואת הלילה 20–21 באפריל",
    "antigua",
    0,
  ],
  ["gua-mex", "להשוות טיסות גואטמלה סיטי ← מקסיקו סיטי", "cdmx", 0],
  ["mex-lapaz", "להשוות טיסות מקסיקו סיטי ← לה פאס", "lapaz", 0],
  ["baja-return", "להשוות טיסה מבאחה למקסיקו סיטי ב־19 במאי", "return", 0],
  [
    "mobula-contact",
    "לפנות למפעילי מובולות: זמינות, שריון ותנאי ביטול ללא חובה לשלם כעת",
    "ventana",
    0,
  ],
  ["semuc-stay", "לאמת ולשריין לינה בסמוק שמפיי", "semuc", 1],
  ["cdmx-stay", "לבדוק לינה במקסיקו סיטי", "cdmx", 1],
  ["baja-stay", "לשריין בסיסי לינה בבאחה עם ביטול חינם", "lapaz", 1],
  ["pulmo-access", "לבדוק תחבורה לקאבו פולמו, ללא הנחת רכב זמין", "pulmo", 1],
  [
    "pulmo-operators",
    "לבדוק מפעילי צלילה בקאבו פולמו ודרישות ניסיון",
    "pulmo",
    1,
  ],
  [
    "mobula-price",
    "לבחון מחיר וזמינות לספארי מובולות יומי משותף",
    "ventana",
    1,
  ],
  [
    "mobula-book",
    "לסגור לפחות יום ספארי מובולות אחד, אם עדיין לא הוזמן",
    "ventana",
    2,
    "mobula-contact",
  ],
  [
    "pulmo-book",
    "לשריין שני ימי צלילה בקאבו פולמו — יעד של ארבע צלילות",
    "pulmo",
    2,
    "pulmo-operators",
  ],
  ["transfers-gear", "לבדוק הסעות וציוד לטרק ולים", "antigua", 2],
  ["insurance", "לוודא ביטוח נסיעות, צלילה, חילוץ וטרקים בגובה", "antigua", 2],
  ["entry", "לבדוק דרישות כניסה עדכניות לגואטמלה ולמקסיקו", "antigua", 2],
  [
    "refresher",
    "לבצע צלילת רענון או צלילות הכנה בישראל לפי הצורך ולאמת יומן צלילות",
    "lapaz",
    2,
  ],
  ["documents", "להכין מסמכים, אישורי הזמנות ופרטי אנשי קשר", "antigua", 2],
  [
    "second-mobula",
    "יום ספארי מובולות שני — ספונטני ובהתאם לתנאים",
    "ventana",
    3,
  ],
  [
    "sightings",
    "יציאות נוספות לפי תצפיות ימיות — ללא הבטחת מפגש",
    "ventana",
    3,
  ],
  ["fishing", "דיג עם קפטנים מקומיים מורשים", "lapaz", 3],
  [
    "atitlan-activities",
    "כפרים, שיט, טבע ורכיבה מאורגנת באטיטלן",
    "atitlan",
    3,
  ],
  ["cdmx-activities", "אוכל, תרבות ושווקים במקסיקו סיטי", "cdmx", 3],
  ["lapaz-dives", "צלילות נוספות בלה פאס בהתאם לניסיון ולים", "lapaz", 3],
  ["stay-flex", "הארכות לינה ושינוי סדר תחנות לפי התנאים", "ventana", 3],
];
export function tripBlueprint() {
  const r = Object.fromEntries(kinds.map((k) => [k, []])) as unknown as Record<
    Kind,
    Entry[]
  >;
  r.destinations = stopData
    .filter((x) => x[0] !== "return")
    .map(([id, title, aliases, country, , , notes]) =>
      rec(`place-${id}`, title, {
        aliases,
        country,
        notes,
        timezone:
          country === "גואטמלה"
            ? "America/Guatemala"
            : ["lapaz", "ventana", "pulmo"].includes(id)
              ? "America/Mazatlan"
              : "America/Mexico_City",
      }),
    );
  r.segments = stopData.map(([id, title, , , date, end, notes]) =>
    rec(`stop-${id}`, title, {
      destinationId: `nature27-place-${id === "return" ? "cdmx" : id}`,
      date,
      end,
      notes,
      type: id === "return" ? "Buffer" : "Stay",
      locked: false,
      planningFixed: ["antigua", "atitlan"].includes(id),
      dateConfidence: ["antigua", "atitlan"].includes(id)
        ? "user-reported"
        : "proposed",
    }),
  );
  r.tasks = taskData.map(([id, title, destination, window, dependency]) =>
    rec(`task-${id}`, title, {
      status: "Todo",
      category: window === 3 ? "Other" : "Logistics",
      priority: window === 0 ? "High" : "Medium",
      window: bookingWindows[window].title,
      bookingWindow: bookingWindows[window].id,
      date: bookingWindows[window].date,
      destinationId: `nature27-place-${destination === "return" ? "cdmx" : destination}`,
      segmentId: `nature27-stop-${destination}`,
      recommendation:
        window === 3
          ? "להשאיר ספונטני"
          : "לבדוק מראש; תשלום רק לאחר בדיקת תנאים",
      deadlineKind: "recommended",
      scheduleOffsetDays:
        window < 3
          ? Math.round(
              (Date.parse(bookingWindows[window].date) -
                Date.parse(stopData.find((s) => s[0] === destination)![4])) /
                86400000,
            )
          : 0,
      notes: "מועד היעד הוא המלצה תכנונית בלבד; אינו מועד סגירה שהוכח מול ספק.",
      dependencies: dependency ? [`nature27-task-${dependency}`] : [],
    }),
  );
  for (const destination of ["antigua", "atitlan"])
    r.bookings.push(
      rec(
        `reported-${destination}`,
        destination === "antigua"
          ? "לינה באנטיגואה — הוזמנה לפי דיווח המשתמש"
          : "לינה באטיטלן — הוזמנה לפי דיווח המשתמש",
        {
          category: "Accommodation",
          destinationId: `nature27-place-${destination}`,
          status: "Tentative booking",
          evidence: "user-reported",
          confidence: "Needs verification",
          paymentStatus: "Unknown",
          notes:
            destination === "antigua"
              ? "פרטי אישור חסרים. Amura Hostel הוזכר כמקום מוכר בלבד; אין לייחס אליו הזמנה ללא אימות. יש לבדוק תאריכים וצ׳ק־אאוט, ובפרט את הלילה 20–21 באפריל."
              : "פרטי אישור חסרים. סן פדרו הוא בסיס מועדף בלבד; יש לבדוק שם נכס, תאריכים וצ׳ק־אאוט מול ההזמנה השמורה.",
        },
      ),
    );
  const marine = [
    [
      "lapaz-sea",
      "לה פאס — צלילות מכלים וחקר ים קורטס",
      "lapaz",
      "Diving",
      0,
      0,
      "דולפינים, כרישים, אריות ים ולהקות דגים",
      "מספר הצלילות ייקבע לפי המפעיל, הניסיון ותנאי הים. Espíritu Santo, שיט ודיג הם אפשרויות נוספות.",
    ],
    [
      "mobula-first",
      "לה ונטנה — ספארי מובולות ראשון",
      "ventana",
      "Wildlife excursions",
      1,
      0,
      "מובולות, אורקות, דולפינים ולווייתנים",
      "סירה משותפת; מפעיל מורשה; עדיפות לשריון יום אחד בהמשך. תקרת העדפה 7,000 MXN ליום — אינה מחיר מאומת.",
    ],
    [
      "mobula-second",
      "לה ונטנה — יום מובולות שני וגמיש",
      "ventana",
      "Wildlife excursions",
      1,
      0,
      "מובולות, אורקות ודולפינים",
      "יום שני ספונטני; אפשר להוסיף יציאות רק לפי תנאים ותקציב.",
    ],
    [
      "pulmo-dives",
      "קאבו פולמו — שני ימי צלילה וארבע צלילות לפחות",
      "pulmo",
      "Diving",
      2,
      4,
      "להקות דגים, כרישים וחיים בשונית",
      "יעד תכנוני בלבד, בכפוף לתנאי הים ולרמת הניסיון. אין לתכנן את סוקורו כטיול יום מלה פאס.",
    ],
    [
      "fishing",
      "לה פאס — דיג עם קפטן מקומי",
      "lapaz",
      "Wildlife excursions",
      0,
      0,
      "חיים ימיים לפי תנאי השטח",
      "יציאה עם מפעיל מורשה ושמירה על כללי הפארק והגנת חיות הבר.",
    ],
  ] as const;
  r.bookings.push(
    ...marine.map(
      ([
        id,
        title,
        destination,
        category,
        plannedDays,
        plannedDives,
        wildlife,
        notes,
      ]) =>
        rec(`marine-${id}`, title, {
          category,
          destinationId: `nature27-place-${destination}`,
          segmentId: `nature27-stop-${destination}`,
          marine: true,
          plannedDays,
          plannedDives,
          wildlife,
          notes,
          status: ["mobula-second", "fishing"].includes(id)
            ? "Optional booking"
            : "Planned booking",
          currency: "MXN",
          budgetMax: id.startsWith("mobula") ? 7000 : 0,
          weatherDependent: true,
          experienceRequirement:
            "Advanced Open Water / שני כוכבים SDI לפי דיווח המשתמש; ניסיון זרמים מוגבל. נדרש אישור התאמה מהמפעיל.",
          cancellation: "תנאים טרם התקבלו; אין להניח ביטול חינם",
          confidence: "Needs verification",
        }),
    ),
  );
  for (const [id, title, from, to, date] of [
    ["gua-mex", "טיסה: גואטמלה סיטי → מקסיקו סיטי", "", "cdmx", "2027-04-30"],
    ["mex-lapaz", "טיסה: מקסיקו סיטי → לה פאס", "cdmx", "lapaz", "2027-05-04"],
    ["baja-mex", "טיסה: באחה → מקסיקו סיטי", "", "cdmx", "2027-05-19"],
    [
      "international",
      "טיסה בינלאומית חזרה — יש לאמת אישור",
      "cdmx",
      "",
      "2027-05-20",
    ],
  ])
    r.transport.push(
      rec(`flight-${id}`, title, {
        type: "Flight",
        date,
        fromDestinationId: from ? `nature27-place-${from}` : "",
        toDestinationId: to ? `nature27-place-${to}` : "",
        origin:
          id === "gua-mex"
            ? "Guatemala City"
            : id === "baja-mex"
              ? "שדה המוצא בבאחה טרם נבחר"
              : "Mexico City",
        destination:
          to === "lapaz"
            ? "La Paz"
            : to === "cdmx"
              ? "Mexico City"
              : "לפי האישור הבינלאומי",
        status: "Planned booking",
        critical: true,
        notes:
          "תאריך תכנוני; אין אישור, מחיר או שעת טיסה מאומתים. אין להסיק שסופק מרווח צלילה–טיסה.",
      }),
    );
  r.transport.push(
    rec("road-atitlan-semuc", "מעבר: אטיטלן → לנקין", {
      type: "Shuttle",
      date: "2027-04-25",
      fromDestinationId: "nature27-place-atitlan",
      toDestinationId: "nature27-place-semuc",
      notes: "יש לברר זמן נסיעה, זמינות ותנאים; לא הוזמן.",
    }),
    rec("road-semuc-gua", "מעבר: לנקין → גואטמלה סיטי", {
      type: "Shuttle",
      date: "2027-04-29",
      fromDestinationId: "nature27-place-semuc",
      destination: "Guatemala City",
      notes: "זמן נסיעה לא מאומת; לשקול לילה סמוך לשדה לפני טיסת 30 באפריל.",
    }),
    rec("road-pulmo", "מעבר: לה ונטנה → קאבו פולמו", {
      type: "Car",
      date: "2027-05-16",
      fromDestinationId: "nature27-place-ventana",
      toDestinationId: "nature27-place-pulmo",
      notes:
        "אופן הנסיעה טרם נבחר: להשוות הסעה ורכב; אין להניח שקיים רכב או מסלול ציבורי נוח.",
    }),
  );
  return r;
}
export function plan2027Update(input: State): State {
  const s = structuredClone(input),
    e = s.expeditions.find((x) => x.id === s.activeId)!;
  if (e.planVersion === PLAN_VERSION) return s;
  const r = s.records[s.activeId],
    blueprint = tripBlueprint();
  const oldDestinations = [...r.destinations];
  const aliases = (r: Entry) =>
    [r.title, ...str(r, "aliases").split(",")].map((s) =>
      s
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase(),
    );
  const mapping: Record<string, string> = {};
  for (const d of blueprint.destinations) {
    const existing = oldDestinations.find((x) =>
      aliases(x).some((a) => aliases(d).includes(a)),
    );
    mapping[d.id] = existing?.id || d.id;
    if (existing) {
      existing.aliases = [
        ...new Set([...aliases(existing), ...aliases(d)]),
      ].join(", ");
    }
  }
  const obsolete =
    /\b(belize|honduras|blue hole|caribbean)\b|בליז|הונדורס|החור הכחול|קריבי/i;
  const archive = (entry: Entry, reason: string) => ({
    ...entry,
    archived: true,
    archiveReason: reason,
    archivedByPlan: PLAN_VERSION,
  });
  // Unconfirmed route drafts are retained verbatim with an archive flag. Confirmed/locked items and all financial history survive.
  r.segments = r.segments.map((x) => {
    const linked = oldDestinations.find((d) => d.id === x.destinationId);
    if (obsolete.test(`${x.title} ${x.notes} ${linked?.title || ""}`))
      return archive(x, "תחנה שהוסרה מהמסלול הפעיל; הפרטים המקוריים נשמרו");
    return x.locked || ["Confirmed", "Booked", "Paid"].includes(x.status)
      ? x
      : archive(x, "טיוטת מסלול קודמת — הוחלפה בתוכנית הטבע והים");
  });
  for (const k of [
    "tasks",
    "destinations",
    "transport",
    "decisions",
    "options",
    "scenarios",
  ] as Kind[]) {
    r[k] = r[k].map((x) => {
      const linked = oldDestinations.find((d) => d.id === x.destinationId);
      const outdated =
        obsolete.test(`${x.title} ${x.notes} ${linked?.title || ""}`) ||
        /five.day|5.day|חמישה ימים|socorro|סוקורו/i.test(x.title);
      const defaultDraft =
        ["tasks", "transport", "decisions"].includes(k) &&
        !x.planVersion &&
        !x.reference &&
        !x.source &&
        !x.paid &&
        ["Todo", "Researching", "Open"].includes(x.status) &&
        /^(t\d+|l\d+|tr\d+|d\d+)$/.test(x.id);
      return outdated
        ? archive(x, "יעד או משימה שאינם חלק מהמסלול הפעיל; נשמרו בארכיון")
        : defaultDraft &&
            !x.locked &&
            !["Confirmed", "Booked", "Paid", "Completed", "Done"].includes(
              x.status,
            )
          ? archive(x, "מידע מהתוכנית הקודמת; נשמר בארכיון")
          : x;
    });
  }
  r.bookings = r.bookings.map((b) =>
    obsolete.test(
      `${b.title} ${b.notes} ${oldDestinations.find((d) => d.id === b.destinationId)?.title || ""}`,
    )
      ? { ...b, routeRelevance: "outside-current-plan" }
      : /^(b1|b2|b3|b4)$/.test(b.id) &&
          [
            "International flights",
            "Antigua hostel",
            "Acatenango overnight trek",
            "Mobula day excursion",
          ].includes(b.title) &&
          !isExistingBooking(b) &&
          !b.reference &&
          !b.paid &&
          !b.amount &&
          !b.source
        ? archive(b, "מציין מקום מהטיוטה הקודמת; אינו אישור הזמנה")
        : b,
  );
  // No existing booking, payment, expense, dive or training log is overwritten or removed.
  for (const k of kinds)
    for (let entry of blueprint[k]) {
      if (k === "destinations" && mapping[entry.id] !== entry.id) continue;
      if (
        k === "bookings" &&
        entry.evidence === "user-reported" &&
        r.bookings.some(
          (b) =>
            (isExistingBooking(b) || !!b.reference || !!b.paid) &&
            b.category === "Accommodation" &&
            b.destinationId ===
              (mapping[str(entry, "destinationId")] || entry.destinationId),
        )
      )
        continue;
      entry = { ...entry };
      for (const field of [
        "destinationId",
        "fromDestinationId",
        "toDestinationId",
      ])
        if (typeof entry[field] === "string" && mapping[str(entry, field)])
          entry[field] = mapping[str(entry, field)];
      if (!r[k].some((x) => x.id === entry.id)) r[k].push(entry);
    }
  e.planVersion = PLAN_VERSION;
  e.previousTitle = e.title;
  e.previousStart = e.start;
  e.previousEnd = e.end;
  e.title = tripTitle;
  e.start = "2027-04-17";
  e.end = "2027-05-20";
  // Keep the existing target/rates; the requested range is stored separately from the user's chosen ceiling.
  e.budgetMin = 20000;
  e.budgetMax = 25000;
  e.certification ||= "Advanced Open Water / שני כוכבים SDI — לפי דיווח המשתמש";
  e.currentExperience ||= "ניסיון מוגבל בזרמים; מספר הצלילות העדכני דורש אימות";
  return stateSchema.parse(s);
}
