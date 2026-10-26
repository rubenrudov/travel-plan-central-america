"use client";
import ReservationIntegrations from "./reservation-integrations";
import {
  cancellationInstant,
  cancellationAlerts,
  matchDestination,
  currentStays,
} from "@/lib/reservations";

import { useEffect, useState } from "react";
import {
  loadWorkspace,
  saveWorkspace,
  downloadBackup,
} from "@/lib/client-store";
import { cloudMode } from "@/lib/supabase";
import {
  Mail,
  Compass,
  LayoutDashboard,
  Map,
  CalendarDays,
  Ticket,
  ArrowLeftRight,
  Backpack,
  Wallet,
  CheckSquare,
  Waves,
  Lightbulb,
  Navigation,
  Plus,
  ArrowUpRight,
  Check,
  Search,
  X,
  Download,
  Settings,
  Mountain,
  Sun,
  ArrowUp,
  ArrowDown,
  Trash2,
  Pencil,
  Globe,
  AlertTriangle,
  ExternalLink,
  Menu,
  CloudOff,
  Leaf,
} from "lucide-react";
import {
  State,
  Entry,
  Kind,
  kinds,
  str,
  num,
  cost,
  totals,
  impacts,
  warnings,
  readiness,
} from "@/lib/model";
import {
  recalculatePayments,
  shareGear,
  newExpeditionRecords,
} from "@/lib/operations";
type Tab = "dashboard" | Kind | "travel" | "settings" | "integrations";
type Field = {
  key: string;
  en: string;
  he: string;
  type?: string;
  options?: string[];
};
const f = (
  key: string,
  en: string,
  he: string,
  type = "text",
  options?: string[],
): Field => ({ key, en, he, type, options });
const base = [
  f("title", "Name", "שם"),
  f("status", "Status", "מצב", "select", [
    "tentative",
    "Confirmed",
    "Estimated",
    "Needs verification",
    "Cancelled",
  ]),
  f("notes", "Notes", "הערות", "textarea"),
];
const money = [
  f("amount", "Total / estimated cost", "עלות כוללת / משוערת", "number"),
  f("currency", "Currency", "מטבע", "select", [
    "ILS",
    "USD",
    "GTQ",
    "MXN",
    "EUR",
  ]),
  f("rate", "Custom rate to ILS (optional)", "שער מותאם לש״ח (רשות)", "number"),
];
const dateFields = [
  f("date", "Start date", "תאריך התחלה", "date"),
  f("end", "End date", "תאריך סיום", "date"),
];
const verification = [
  f("source", "Source URL", "קישור למקור", "url"),
  f("checked", "Date checked", "תאריך בדיקה", "date"),
  f("confidence", "Confidence", "רמת ודאות", "select", [
    "Needs verification",
    "Estimated",
    "Confirmed",
  ]),
];
const fields: Record<Kind, Field[]> = {
  tasks: [
    f("title", "Task", "משימה"),
    f("status", "Status", "מצב", "select", [
      "Todo",
      "In progress",
      "Done",
      "Cancelled",
    ]),
    f("category", "Category", "קטגוריה", "select", [
      "Documents",
      "Health",
      "Diving",
      "Trekking",
      "Logistics",
      "Other",
    ]),
    f("priority", "Priority", "עדיפות", "select", ["High", "Medium", "Low"]),
    f("window", "Preparation window", "חלון הכנה"),
    f("date", "Deadline (only if known)", "מועד אחרון (אם ידוע)", "date"),
    f("bookingId", "Related booking", "הזמנה קשורה", "booking"),
    f("dependencies", "Task dependencies", "משימות מקדימות", "dependencies"),
    f("notes", "Notes / evidence", "הערות / אסמכתאות", "textarea"),
    ...verification,
  ],
  destinations: [
    ...base,
    f("country", "Country", "מדינה"),
    f(
      "aliases",
      "Alternative destination names (comma-separated)",
      "שמות חלופיים ליעד (מופרדים בפסיקים)",
    ),
    f("timezone", "IANA timezone", "אזור זמן IANA"),
    ...dateFields,
  ],
  segments: [
    ...base,
    f("destinationId", "Destination", "יעד", "destination"),
    ...dateFields,
    f("type", "Segment type", "סוג מקטע", "select", [
      "Stay",
      "Activity",
      "Transport",
      "Buffer",
      "Free day",
    ]),
    f("locked", "Lock dates", "נעילת תאריכים", "checkbox"),
    ...money,
    f("dependencies", "Dependencies", "תלויות", "dependencies"),
  ],
  bookings: [
    f("title", "Booking name", "שם ההזמנה"),
    f("status", "Booking status", "מצב הזמנה", "select", [
      "Idea",
      "Researching",
      "Shortlisted",
      "Ready to book",
      "Booked",
      "Paid",
      "Cancelled",
    ]),
    f("provider", "Provider", "ספק"),
    f("bookingSource", "Reservation source", "מקור ההזמנה", "select", [
      "Booking.com",
      "Hostelworld",
      "Direct",
      "Other",
    ]),
    f("propertyName", "Property name", "שם מקום האירוח"),
    f("stayAddress", "Accommodation address", "כתובת מקום האירוח"),
    f("category", "Category", "קטגוריה", "select", [
      "Flights",
      "Accommodation",
      "Transport",
      "Trekking",
      "Diving",
      "Wildlife excursions",
      "Insurance",
      "Car rental",
      "Other",
    ]),
    f("destinationId", "Destination", "יעד", "destination"),
    ...dateFields,
    f("departure", "Start time (with date)", "מועד התחלה", "datetime-local"),
    f("arrival", "End time (with date)", "מועד סיום", "datetime-local"),
    ...money,
    f(
      "paid",
      "Total payments so far (original currency)",
      "סך ששולם עד כה (מטבע מקורי)",
      "number",
    ),
    f("paymentStatus", "Payment status", "מצב תשלום", "select", [
      "Unknown",
      "Unpaid",
      "Deposit paid",
      "Paid",
      "Refunded",
    ]),
    f("balanceDate", "Balance due", "מועד יתרה לתשלום", "date"),
    f("reference", "Confirmation reference", "מספר אישור"),
    f("cancellation", "Cancellation terms", "תנאי ביטול", "textarea"),
    f(
      "cancelDate",
      "Legacy cancellation date (time unverified)",
      "תאריך ביטול קודם (שעה לא מאומתת)",
      "date",
    ),
    f("cancellationPolicy", "Cancellation policy", "מדיניות ביטול", "select", [
      "Unknown",
      "Free cancellation",
      "Non-refundable",
    ]),
    f(
      "freeCancellationLocal",
      "Free cancellation ends (property local date and time)",
      "סיום ביטול חינם (תאריך ושעה מקומיים בנכס)",
      "datetime-local",
    ),
    f(
      "cancellationTimezone",
      "Deadline timezone (e.g. America/Guatemala)",
      "אזור זמן למועד (למשל America/Guatemala)",
    ),
    f(
      "cancellationVerified",
      "Exact deadline and timezone verified against provider",
      "המועד המדויק ואזור הזמן אומתו מול הספק",
      "checkbox",
    ),
    f(
      "emailReminder",
      "Email me one week before free cancellation ends",
      "שליחת תזכורת בדוא״ל שבוע לפני סיום ביטול חינם",
      "checkbox",
    ),
    f("source", "Booking URL", "קישור להזמנה", "url"),
    f(
      "document",
      "Private document reference (no uploads)",
      "הפניה למסמך פרטי",
    ),
    f("dependencies", "Dependencies", "תלויות", "dependencies"),
    f("notes", "Notes", "הערות", "textarea"),
  ],
  transport: [
    ...base,
    f("origin", "Origin", "מוצא"),
    f("destination", "Destination", "יעד"),
    f("type", "Transport type", "סוג תחבורה", "select", [
      "Transfer",
      "Flight",
      "Shuttle",
      "Boat",
      "Bus",
      "Rental car",
      "Walk",
    ]),
    f("date", "Date", "תאריך", "date"),
    f("departure", "Departure", "יציאה", "datetime-local"),
    f("arrival", "Arrival", "הגעה", "datetime-local"),
    f("timezone", "Timezone (IANA)", "אזור זמן"),
    f("duration", "Estimated duration (minutes)", "משך משוער בדקות", "number"),
    f("buffer", "Connection buffer (minutes)", "מרווח מעבר בדקות", "number"),
    ...money,
    f("actual", "Actual cost", "עלות בפועל", "number"),
    f("operator", "Operator", "מפעיל"),
    f("luggage", "Luggage constraints", "מגבלות כבודה"),
    f("reservation", "Reservation requirements", "דרישות הזמנה"),
    f("dependencies", "Dependencies", "תלויות", "dependencies"),
    ...verification,
  ],
  gear: [
    f("title", "Item", "פריט"),
    f("category", "Category", "קטגוריה", "select", [
      "Trekking",
      "Backpacking",
      "Scuba diving",
      "Snorkeling",
      "Photography",
      "Drone",
      "Electronics",
      "Clothing",
      "Medical",
      "Travel essentials",
    ]),
    f("ownership", "Ownership", "בעלות", "select", [
      "unverified",
      "owned",
      "buy",
      "rent",
      "borrow",
    ]),
    f("condition", "Condition", "מצב הציוד"),
    f("quantity", "Quantity", "כמות", "number"),
    f("weight", "Weight per item (grams)", "משקל לפריט בגרמים", "number"),
    f("location", "Storage location", "מקום אחסון"),
    ...money,
    f("actual", "Actual purchase price", "מחיר רכישה בפועל", "number"),
    f("rental", "Rental cost", "עלות השכרה", "number"),
    f("priority", "Priority", "עדיפות", "select", ["High", "Medium", "Low"]),
    f("destinationId", "Useful at destination", "שימושי ביעד", "destination"),
    f(
      "packing",
      "Include in expedition packing",
      "הוספה לרשימת אריזה",
      "checkbox",
    ),
    f("packed", "Packed", "ארוז", "checkbox"),
    f("notes", "Notes", "הערות", "textarea"),
  ],
  expenses: [
    ...base,
    ...money,
    f("category", "Category", "קטגוריה", "select", [
      "Flights",
      "Accommodation",
      "Food",
      "Transport",
      "Trekking",
      "Diving",
      "Wildlife excursions",
      "Equipment",
      "Insurance",
      "Other",
      "Contingency",
    ]),
    f("date", "Date", "תאריך", "date"),
    f("destinationId", "Destination", "יעד", "destination"),
    f(
      "bookingId",
      "Related booking (payment only)",
      "הזמנה קשורה (תשלום בלבד)",
      "booking",
    ),
  ],
  dives: [
    f("title", "Dive location", "מיקום הצלילה"),
    f("status", "Status", "מצב", "select", ["Planned", "Completed"]),
    f("date", "Dive date", "תאריך צלילה", "date"),
    f("depth", "Maximum depth (m)", "עומק מרבי במטרים", "number"),
    f("duration", "Duration (minutes)", "משך בדקות", "number"),
    f("type", "Dive type", "סוג צלילה"),
    f("current", "Current conditions", "תנאי זרם"),
    f("skills", "Skills practiced", "מיומנויות שתורגלו"),
    f("notes", "Notes", "הערות", "textarea"),
  ],
  training: [
    f("title", "Training activity", "פעילות אימון"),
    f("status", "Status", "מצב", "select", ["Planned", "Completed"]),
    f("date", "Date", "תאריך", "date"),
    f("distance", "Distance (km)", "מרחק בק״מ", "number"),
    f("elevation", "Elevation gain (m)", "טיפוס במטרים", "number"),
    f("duration", "Duration (minutes)", "משך בדקות", "number"),
    f("weight", "Backpack weight (kg)", "משקל תיק בק״ג", "number"),
    f("difficulty", "Perceived difficulty", "קושי נתפס", "select", [
      "Easy",
      "Moderate",
      "Hard",
    ]),
    f("notes", "Notes", "הערות", "textarea"),
  ],
  decisions: [
    f("title", "Decision", "החלטה"),
    f("status", "Status", "מצב", "select", [
      "Open",
      "Researching",
      "Decided",
      "Deferred",
    ]),
    f("date", "Decision deadline", "מועד החלטה", "date"),
    f("chosen", "Chosen option", "אפשרות שנבחרה"),
    f("rationale", "Decision rationale", "נימוק להחלטה", "textarea"),
    ...verification,
    f("notes", "Notes", "הערות", "textarea"),
  ],
  options: [
    f("title", "Option / provider", "אפשרות / ספק"),
    f("decisionId", "Related decision", "החלטה קשורה", "decision"),
    ...money,
    f("pros", "Pros", "יתרונות", "textarea"),
    f("cons", "Cons / cancellation terms", "חסרונות / תנאי ביטול", "textarea"),
    ...verification,
    f("notes", "Notes", "הערות", "textarea"),
  ],
  scenarios: [
    f("title", "Scenario", "תרחיש"),
    f("mobulaDays", "Mobula days", "ימי מובולה", "number"),
    f(
      "dailyCost",
      "Cost per day (MXN, planning assumption)",
      "עלות ליום ב־MXN (הנחה לתכנון)",
      "number",
    ),
    f(
      "extra",
      "Other cost changes (ILS, may be negative)",
      "שינויי עלויות אחרים בש״ח",
      "number",
    ),
    f("notes", "Notes", "הערות", "textarea"),
  ],
  contacts: [
    f("title", "Contact name", "שם איש קשר"),
    f("phone", "Phone", "טלפון"),
    f("notes", "Notes", "הערות", "textarea"),
  ],
};
const nav = [
  ["dashboard", "Overview", "מבט על", LayoutDashboard],
  ["segments", "Itinerary", "מסלול הטיול", Map],
  ["tasks", "Preparation", "הכנות לדרך", CheckSquare],
  ["bookings", "Bookings", "הזמנות", Ticket],
  ["integrations", "Reservation sync", "סנכרון הזמנות", Mail],
  ["transport", "Connections", "תחבורה ומעברים", ArrowLeftRight],
  ["gear", "Gear & packing", "ציוד ואריזה", Backpack],
  ["expenses", "Budget", "תקציב והוצאות", Wallet],
  ["decisions", "Research & decisions", "מחקר והחלטות", Lightbulb],
  ["dives", "Dive & trek log", "יומן צלילה ואימון", Waves],
  ["travel", "Travel mode", "מצב מסע", Navigation],
] as const;
export default function Adventure({
  accountEmail,
  onSignOut,
}: { accountEmail?: string; onSignOut?: () => void } = {}) {
  const [now, setNow] = useState(() => Date.now());
  const [state, setState] = useState<State | null>(null),
    [lang, setLang] = useState<"he" | "en">("he"),
    [tab, setTab] = useState<Tab>("dashboard"),
    [search, setSearch] = useState(""),
    [editor, setEditor] = useState<{ kind: Kind; record: Entry } | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [mobile, setMobile] = useState(false),
    [filter, setFilter] = useState("All"),
    [impact, setImpact] = useState<{ record: Entry; affected: Entry[] } | null>(
      null,
    ),
    [packing, setPacking] = useState(false),
    [travelDate, setTravelDate] = useState(
      new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" }),
    );
  const t = (en: string, he: string) => (lang === "he" ? he : en);
  useEffect(() => {
    const update = () => setNow(Date.now());
    const interval = setInterval(update, 60000);
    document.addEventListener("visibilitychange", update);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  useEffect(() => {
    loadWorkspace()
      .then((s) => {
        setState(s);
        if (new URLSearchParams(window.location.search).has("gmail"))
          setTab("integrations");
        if (!cloudMode)
          localStorage.setItem("adventure-cache", JSON.stringify(s));
        const l = localStorage.getItem("adventure-lang");
        if (l === "en") setLang("en");
      })
      .catch((error) => {
        if (cloudMode) {
          setError(
            error instanceof Error
              ? error.message
              : "Could not load your workspace",
          );
          return;
        }
        const cache = localStorage.getItem("adventure-cache");
        if (cache) {
          setState(JSON.parse(cache));
          setError(
            "Offline: showing cached records. Editing requires a server connection.",
          );
        } else setError("Could not load expedition. Please reload.");
      });
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "he" ? "rtl" : "ltr";
  }, [lang]);
  const editorOpen = !!editor,
    impactOpen = !!impact;
  useEffect(() => {
    if (!editorOpen && !impactOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const root = document.querySelector(
      impactOpen ? ".impact-dialog" : ".editor",
    ) as HTMLElement | null;
    const focusable = () =>
      Array.from(
        root?.querySelectorAll<HTMLElement>(
          "button:not(:disabled),input:not(:disabled),select,textarea,a[href]",
        ) || [],
      );
    const first = focusable()[0];
    first?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (impactOpen) setImpact(null);
        else setEditor(null);
      }
      if (event.key === "Tab") {
        const nodes = focusable();
        const first = nodes[0],
          last = nodes.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [editorOpen, impactOpen]);
  async function persist(next: State) {
    setBusy(true);
    setError("");
    try {
      const data = await saveWorkspace(next);
      setState(data);
      if (!cloudMode)
        localStorage.setItem("adventure-cache", JSON.stringify(data));
      setNotice(t("Changes saved", "השינויים נשמרו"));
      setTimeout(() => setNotice(""), 2500);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
      return false;
    } finally {
      setBusy(false);
    }
  }
  if (!state)
    return (
      <main className="loading">
        <Compass size={46} />
        <h1>Adventure OS</h1>
        <p>{error || "מכינים את ההרפתקה הבאה שלך…"}</p>
      </main>
    );
  const expedition = state.expeditions.find((e) => e.id === state.activeId)!;
  const records = state.records[state.activeId];
  const total = totals(records, expedition);
  const prep = records.tasks.filter((x) => x.status === "Done").length;
  const percent = Math.round((prep / Math.max(records.tasks.length, 1)) * 100);
  const dive = readiness(records.dives);
  const moneyFmt = (n: number) =>
    new Intl.NumberFormat(lang === "he" ? "he-IL" : "en-IL", {
      style: "currency",
      currency: "ILS",
      maximumFractionDigits: 0,
    }).format(n);
  const dateFmt = (d: string) =>
    d
      ? new Intl.DateTimeFormat(lang === "he" ? "he-IL" : "en-GB", {
          day: "numeric",
          month: "short",
          timeZone: "UTC",
        }).format(new Date(d + "T12:00:00Z"))
      : t("Dates to decide", "תאריכים לבחירה");
  const days = Math.max(
    0,
    Math.ceil(
      (Date.parse(expedition.start + "T00:00:00+03:00") - now) / 86400000,
    ),
  );
  const go = (next: Tab) => {
    setTab(next);
    setSearch("");
    setFilter("All");
    setPacking(false);
    setMobile(false);
  };
  const open = (kind: Kind, record?: Entry) =>
    setEditor({
      kind,
      record: record
        ? { ...record }
        : {
            id: crypto.randomUUID(),
            title: "",
            status:
              kind === "tasks"
                ? "Todo"
                : kind === "bookings"
                  ? "Idea"
                  : kind === "dives" || kind === "training"
                    ? "Planned"
                    : "tentative",
            notes: "",
            ...(kind === "gear"
              ? { ownership: "unverified", quantity: 1 }
              : {}),
            ...(kind === "scenarios"
              ? { mobulaDays: 2, dailyCost: 7000, extra: 0 }
              : {}),
          },
    });
  async function saveRecord(kind: Kind, record: Entry) {
    if (kind === "bookings") {
      try {
        record = { ...record };
        if (
          record.cancellationPolicy === "Free cancellation" &&
          record.freeCancellationLocal
        ) {
          record.freeCancellationAt = cancellationInstant(
            str(record, "freeCancellationLocal"),
            str(record, "cancellationTimezone"),
          );
        } else {
          record.freeCancellationAt = "";
          record.cancellationVerified = false;
        }
        if (!record.destinationId && record.stayAddress) {
          const destination = matchDestination(
            str(record, "stayAddress"),
            records.destinations,
          );
          if (destination) record.destinationId = destination;
        }
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Invalid cancellation deadline",
        );
        return;
      }
    }
    if (
      kind === "gear" &&
      record.ownership === "buy" &&
      Object.values(state!.records)
        .flatMap((r) => r.gear)
        .some(
          (g) =>
            g.id !== record.id &&
            g.ownership === "owned" &&
            g.title.trim().toLowerCase() === record.title.trim().toLowerCase(),
        )
    ) {
      setError(
        t(
          "An owned item with this name already exists. Check inventory before buying.",
          "כבר קיים פריט בבעלותך בשם זה. יש לבדוק לפני רכישה.",
        ),
      );
      return;
    }
    const list = records[kind].some((x) => x.id === record.id)
      ? records[kind].map((x) => (x.id === record.id ? record : x))
      : [...records[kind], record];
    let updated = { ...records, [kind]: list };
    if (kind === "bookings" && ["Booked", "Paid"].includes(record.status))
      updated = {
        ...updated,
        tasks: updated.tasks.map((x) =>
          x.bookingId === record.id ? { ...x, status: "Done" } : x,
        ),
      };
    if (kind === "expenses") {
      const previous = records.expenses.find((x) => x.id === record.id);
      updated = recalculatePayments(updated, expedition, [
        String(record.bookingId || ""),
        String(previous?.bookingId || ""),
      ]);
    }
    const nextRecords =
      kind === "gear"
        ? shareGear(state!, state!.activeId, record)
        : state!.records;
    if (
      await persist({
        ...state!,
        records: { ...nextRecords, [state!.activeId]: updated },
      })
    ) {
      setEditor(null);
      setImpact(null);
    }
  }
  async function remove(kind: Kind, id: string) {
    if (
      !confirm(
        t(
          "Delete this record? Linked references will be cleared.",
          "למחוק את הרשומה? קישורים אליה יוסרו.",
        ),
      )
    )
      return;
    let updated = {
      ...records,
      [kind]: records[kind].filter((x) => x.id !== id),
    };
    if (kind === "expenses")
      updated = recalculatePayments(updated, expedition, [
        str(
          records.expenses.find((x) => x.id === id)!,
          "bookingId",
        ),
      ]);
    for (const key of kinds)
      updated[key] = updated[key].map((r) => {
        const next = { ...r };
        for (const field of ["bookingId", "destinationId", "decisionId"])
          if (next[field] === id) next[field] = "";
        if (Array.isArray(next.dependencies))
          next.dependencies = next.dependencies.filter((x) => x !== id);
        return next;
      });
    await persist({
      ...state!,
      records: { ...state!.records, [state!.activeId]: updated },
    });
  }
  const activeNav = nav.find((n) => n[0] === tab);
  const title = activeNav
    ? lang === "he"
      ? activeNav[2]
      : activeNav[1]
    : (
        {
          destinations: t("Destinations", "יעדים"),
          training: t("Training journal", "יומן אימונים"),
          options: t("Compare options", "השוואת אפשרויות"),
          scenarios: t("Budget scenarios", "תרחישי תקציב"),
          contacts: t("Emergency contacts", "אנשי קשר לחירום"),
          settings: t("Expedition settings", "הגדרות מסע"),
        } as Partial<Record<Tab, string>>
      )[tab];
  const pending = records.tasks
    .filter((x) => !["Done", "Cancelled"].includes(x.status))
    .sort(
      (a, b) =>
        Number(b.priority === "High") - Number(a.priority === "High") ||
        (str(a, "date") || "9999").localeCompare(str(b, "date") || "9999"),
    );
  const bookingQueue = records.bookings
    .filter((b) => !["Booked", "Paid", "Cancelled"].includes(b.status))
    .sort((a, b) => {
      const blocked = (r: Entry) =>
        Array.isArray(r.dependencies) &&
        r.dependencies.some(
          (id) =>
            !records.bookings.some(
              (x) => x.id === id && ["Booked", "Paid"].includes(x.status),
            ),
        );
      return (
        Number(blocked(a)) - Number(blocked(b)) ||
        (str(a, "date") || "9999").localeCompare(str(b, "date") || "9999")
      );
    });
  const destinationName = (r: Entry) =>
    records.destinations.find((x) => x.id === r.destinationId)?.title || "";
  const statusLabel = (s: string) =>
    lang === "en"
      ? s
      : (
          {
            Todo: "לביצוע",
            "In progress": "בתהליך",
            Done: "הושלם",
            tentative: "בתכנון",
            Confirmed: "מאושר",
            Estimated: "הערכה",
            "Needs verification": "דורש אימות",
            Cancelled: "בוטל",
            Researching: "במחקר",
            Idea: "רעיון",
            Shortlisted: "ברשימה",
            "Ready to book": "מוכן להזמנה",
            Booked: "הוזמן",
            Paid: "שולם",
            Planned: "מתוכנן",
            Completed: "בוצע",
            Open: "פתוח",
            Decided: "הוחלט",
            Deferred: "נדחה",
            owned: "בבעלותי",
            unverified: "בעלות לא מאומתת",
            buy: "לקנייה",
            rent: "להשכרה",
            borrow: "להשאלה",
          } as Record<string, string>
        )[s] || s;
  function badge(s: string) {
    return (
      <span
        className={
          "badge " +
          ([
            "Done",
            "Booked",
            "Paid",
            "Completed",
            "owned",
            "Confirmed",
          ].includes(s)
            ? "green"
            : ["High", "buy", "Needs verification"].includes(s)
              ? "amber"
              : "")
        }
      >
        {statusLabel(s)}
      </span>
    );
  }
  function list(kind: Kind) {
    const all = records[kind];
    const visible = all.filter(
      (r) =>
        (!search ||
          JSON.stringify(r).toLowerCase().includes(search.toLowerCase())) &&
        (filter === "All" || r.status === filter || r.ownership === filter) &&
        (kind !== "gear" || !packing || r.packing),
    );
    return (
      <>
        <div className="list-tools">
          <div className="search">
            <Search size={17} />
            <input
              aria-label={t("Search records", "חיפוש רשומות")}
              placeholder={t("Search this collection…", "חיפוש ברשימה…")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            aria-label="Filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="All">{t("All statuses", "כל המצבים")}</option>
            {Array.from(
              new Set(
                all.map((x) =>
                  str(x, kind === "gear" ? "ownership" : "status"),
                ),
              ),
            ).map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </select>
          <span className="muted">
            {visible.length} {t("records", "רשומות")}
          </span>
        </div>
        {kind === "gear" && (
          <div className="inline-summary">
            <span>
              {t("Packed", "ארוז")}:{" "}
              {all.filter((x) => x.packing && x.packed).length}/
              {all.filter((x) => x.packing).length}
            </span>
            <span>
              {t("Pack weight", "משקל אריזה")}:{" "}
              {(
                all
                  .filter((x) => x.packing)
                  .reduce(
                    (s, x) =>
                      s + num(x, "weight") * Math.max(1, num(x, "quantity")),
                    0,
                  ) / 1000
              ).toFixed(1)}{" "}
              kg
            </span>
            <button
              onClick={() => {
                setPacking(!packing);
                setFilter("All");
              }}
            >
              {packing
                ? t("All inventory", "כל הציוד")
                : t("Packing list", "רשימת אריזה")}
            </button>
            <button
              onClick={() =>
                persist({
                  ...state!,
                  records: {
                    ...state!.records,
                    [state!.activeId]: {
                      ...records,
                      gear: all.map((g) => ({ ...g, packing: true })),
                    },
                  },
                })
              }
            >
              {t(
                "Generate packing list from inventory",
                "יצירת רשימת אריזה מהציוד",
              )}
            </button>
          </div>
        )}
        <div className={"records " + (kind === "segments" ? "timeline" : "")}>
          {visible.map((r, index) => (
            <article
              className="record"
              key={r.id}
              draggable={kind === "segments" && !r.locked}
              onDragStart={(e) => e.dataTransfer.setData("text/plain", r.id)}
              onDragOver={(e) => kind === "segments" && e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/plain");
                if (kind !== "segments" || r.locked) return;
                const moving = records.segments.find((x) => x.id === id);
                if (!moving || moving.locked) return;
                const reordered = records.segments.filter((x) => x.id !== id);
                reordered.splice(
                  reordered.findIndex((x) => x.id === r.id),
                  0,
                  moving,
                );
                persist({
                  ...state!,
                  records: {
                    ...state!.records,
                    [state!.activeId]: { ...records, segments: reordered },
                  },
                });
              }}
            >
              {kind === "segments" && (
                <div className="timeline-marker">
                  {String(index + 1).padStart(2, "0")}
                </div>
              )}
              {kind === "tasks" && (
                <button
                  className={"check " + (r.status === "Done" ? "checked" : "")}
                  aria-label={t("Toggle task", "שינוי מצב משימה")}
                  onClick={() => {
                    const deps = Array.isArray(r.dependencies)
                      ? r.dependencies
                      : [];
                    if (
                      r.status !== "Done" &&
                      deps.some(
                        (id) =>
                          records.tasks.find((x) => x.id === id)?.status !==
                          "Done",
                      )
                    ) {
                      setError(
                        t(
                          "Finish prerequisite tasks first.",
                          "יש להשלים את המשימות המקדימות תחילה.",
                        ),
                      );
                      return;
                    }
                    saveRecord(kind, {
                      ...r,
                      status: r.status === "Done" ? "Todo" : "Done",
                    });
                  }}
                >
                  {r.status === "Done" && <Check size={14} />}
                </button>
              )}
              <div className="record-main">
                <div className="record-eyebrow">
                  {str(r, "category") ||
                    str(r, "type") ||
                    destinationName(r) ||
                    str(r, "country")}
                  {r.locked ? " · 🔒" : ""}
                </div>
                <button className="record-title" onClick={() => open(kind, r)}>
                  {r.title}
                </button>
                {kind === "bookings" && r.stayAddress && (
                  <p className="stay-address">{str(r, "stayAddress")}</p>
                )}
                {kind === "bookings" && r.freeCancellationAt && (
                  <p className="muted">
                    {t("Free cancellation ends", "ביטול חינם עד")}:{" "}
                    {str(r, "freeCancellationLocal")} ·{" "}
                    {str(r, "cancellationTimezone")}{" "}
                    {r.cancellationVerified
                      ? "✓"
                      : t("Needs verification", "דורש אימות")}
                  </p>
                )}
                {kind === "destinations" &&
                  currentStays(records, r.id, travelDate).map((stay) => (
                    <p className="stay-address" key={stay.id}>
                      {t("Current stay", "לינה נוכחית")}: {stay.title} ·{" "}
                      {str(stay, "stayAddress")}
                    </p>
                  ))}
                <div className="record-meta">
                  {r.date && (
                    <span>
                      <CalendarDays size={13} />
                      {dateFmt(str(r, "date"))}
                      {r.end ? " — " + dateFmt(str(r, "end")) : ""}
                    </span>
                  )}
                  {r.window && <span>{str(r, "window")}</span>}
                  {r.provider && <span>{str(r, "provider")}</span>}
                  {r.amount && (
                    <span>
                      {num(r, "amount").toLocaleString()}{" "}
                      {str(r, "currency") || "ILS"}
                    </span>
                  )}
                  {r.notes && (
                    <span className="note-preview">{str(r, "notes")}</span>
                  )}
                </div>
                {kind === "scenarios" && (
                  <p className="scenario-total">
                    {moneyFmt(
                      total.estimated +
                        num(r, "mobulaDays") *
                          num(r, "dailyCost") *
                          (expedition.rates.MXN || 1) +
                        num(r, "extra"),
                    )}{" "}
                    <small>
                      {t(
                        "forecast including additional excursions",
                        "תחזית הכוללת טיולים נוספים",
                      )}
                    </small>
                  </p>
                )}
                {kind === "options" && (
                  <div className="option-details">
                    <span>+ {str(r, "pros") || "—"}</span>
                    <span>− {str(r, "cons") || "—"}</span>
                  </div>
                )}
                {r.source && /^https?:\/\//.test(str(r, "source")) && (
                  <a
                    className="source"
                    href={str(r, "source")}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t("Source", "מקור")} <ExternalLink size={12} />
                  </a>
                )}
              </div>
              <div className="record-actions">
                {badge(str(r, kind === "gear" ? "ownership" : "status"))}
                {kind === "gear" && r.packing && (
                  <label className="packed">
                    <input
                      type="checkbox"
                      checked={!!r.packed}
                      onChange={(e) =>
                        saveRecord(kind, { ...r, packed: e.target.checked })
                      }
                    />
                    {t("Packed", "ארוז")}
                  </label>
                )}
                <button
                  className="icon-button"
                  aria-label={t("Edit", "עריכה")}
                  onClick={() => open(kind, r)}
                >
                  <Pencil size={15} />
                </button>
                <button
                  className="icon-button delete"
                  aria-label={t("Delete", "מחיקה")}
                  onClick={() => remove(kind, r.id)}
                >
                  <Trash2 size={15} />
                </button>
                {kind === "segments" && (
                  <span className="reorder">
                    <button
                      aria-label="Move up"
                      disabled={index === 0 || !!r.locked}
                      onClick={() => move(index, -1)}
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      aria-label="Move down"
                      disabled={index === all.length - 1 || !!r.locked}
                      onClick={() => move(index, 1)}
                    >
                      <ArrowDown size={14} />
                    </button>
                  </span>
                )}
              </div>
            </article>
          ))}
        </div>
        {!visible.length && (
          <div className="empty">
            <Compass size={35} />
            <h3>
              {t("A little space for possibility", "מקום לאפשרויות חדשות")}
            </h3>
            <p>
              {t(
                "Add your first record, or try another filter.",
                "הוסיפו רשומה חדשה, או נסו סינון אחר.",
              )}
            </p>
            <button className="primary" onClick={() => open(kind)}>
              <Plus size={16} />
              {t("Add a record", "הוספת רשומה")}
            </button>
          </div>
        )}
      </>
    );
  }
  function move(index: number, delta: number) {
    const reordered = [...records.segments];
    if (reordered[index + delta]?.locked) {
      setError(
        t(
          "Unlock the neighboring segment first.",
          "יש לבטל את נעילת המקטע הסמוך.",
        ),
      );
      return;
    }
    [reordered[index], reordered[index + delta]] = [
      reordered[index + delta],
      reordered[index],
    ];
    persist({
      ...state!,
      records: {
        ...state!.records,
        [state!.activeId]: { ...records, segments: reordered },
      },
    });
  }
  return (
    <div className="app">
      <aside className={"sidebar " + (mobile ? "is-open" : "")}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            go("dashboard");
          }}
        >
          <span className="brand-symbol">
            <Compass size={26} />
          </span>
          <span>
            ADVENTURE<span className="brand-os">OS</span>
            <small>PLAN LESS. EXPERIENCE MORE.</small>
          </span>
        </a>
        <div className="workspace-label">
          {t("YOUR EXPEDITIONS", "המסעות שלך")}
        </div>
        <label className="expedition-select">
          <span className="mini-flag">G / M</span>
          <select
            aria-label="Active expedition"
            value={state.activeId}
            onChange={(e) => persist({ ...state, activeId: e.target.value })}
          >
            {state.expeditions.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}
              </option>
            ))}
          </select>
        </label>
        <div className="workspace-label">{t("WORKSPACE", "סביבת המסע")}</div>
        <nav>
          {nav.map(([id, en, he, Icon]) => (
            <button
              key={id}
              onClick={() => go(id)}
              className={tab === id ? "active" : ""}
            >
              <Icon size={18} />
              <span>{t(en, he)}</span>
              {id === "tasks" && <small>{pending.length}</small>}
              {id === "travel" && <span className="live-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="departure-note">
            <Mountain size={24} />
            <span>
              {t("The adventure is getting closer.", "ההרפתקה מתקרבת.")}
              <strong>
                {days} {t("days to go", "ימים ליציאה")}
              </strong>
            </span>
          </div>
          <button className="settings-button" onClick={() => go("settings")}>
            <Settings size={17} />
            {t("Expedition settings", "הגדרות מסע")}
          </button>
          <div className="profile">
            <span className="avatar">R</span>
            <span>
              {t("My expedition workspace", "סביבת המסע האישית")}
              <small>
                {cloudMode
                  ? t(
                      "Private · synced to your account",
                      "פרטי · מסונכרן לחשבון שלך",
                    )
                  : t(
                      "Local & private · this device",
                      "מקומי ופרטי · במכשיר זה",
                    )}
              </small>
            </span>
            <Leaf size={17} />
          </div>
        </div>
      </aside>
      {mobile && (
        <button
          className="scrim"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="mobile-menu icon-button"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Menu size={20} />
            </button>
            <span>{t("My workspace", "סביבת העבודה שלי")}</span>
            <span className="slash">/</span>
            <strong>{title}</strong>
          </div>
          <div className="topbar-actions">
            <span className="save-indicator">
              <span className="live-dot" />
              {busy
                ? t("Saving…", "שומר…")
                : cloudMode
                  ? t("Cloud synced", "סונכרן לענן")
                  : t("Locally saved", "נשמר מקומית")}
            </span>
            {onSignOut && (
              <button
                className="language"
                title={accountEmail}
                onClick={onSignOut}
              >
                {t("Sign out", "יציאה מהחשבון")}
              </button>
            )}
            <button
              className="language"
              onClick={() => {
                const next = lang === "he" ? "en" : "he";
                setLang(next);
                localStorage.setItem("adventure-lang", next);
              }}
            >
              <Globe size={15} />
              {lang === "he" ? "EN" : "עברית"}
            </button>
            <button
              className="avatar small"
              onClick={() => go("settings")}
              aria-label="Settings"
            >
              R
            </button>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {t("YOUR NEXT CHAPTER", "הפרק הבא שלך")} <span>•</span>{" "}
                {expedition.start.slice(0, 4)}
              </div>
              <h1>
                {tab === "dashboard"
                  ? t(
                      "A little planning. A lot of adventure.",
                      "קצת תכנון. הרבה הרפתקה.",
                    )
                  : title}
              </h1>
              <p>
                {tab === "dashboard"
                  ? t(
                      "Everything you need to get ready. Freedom to explore when you get there.",
                      "כל מה שצריך כדי לצאת מוכנים. והחופש לגלות כשמגיעים.",
                    )
                  : t(
                      "Plan with intention. Leave room for the unexpected.",
                      "לתכנן מתוך כוונה. להשאיר מקום לבלתי צפוי.",
                    )}
              </p>
            </div>
            {tab === "dashboard" ? (
              <button className="secondary" onClick={() => go("segments")}>
                <Map size={16} />
                {t("View itinerary", "למסלול הטיול")}
                <ArrowUpRight size={15} />
              </button>
            ) : kinds.includes(tab as Kind) ? (
              <button
                className="primary"
                disabled={busy}
                onClick={() => open(tab as Kind)}
              >
                <Plus size={17} />
                {t("Add new", "הוספה חדשה")}
              </button>
            ) : null}
          </div>
          {error && (
            <div className="alert" role="alert">
              <AlertTriangle size={17} />
              <span>{error}</span>
              <button onClick={() => setError("")} aria-label="Dismiss">
                <X size={15} />
              </button>
            </div>
          )}
          {notice && (
            <div className="toast" role="status">
              <Check size={16} />
              {notice}
            </div>
          )}
          {tab === "dashboard" && (
            <>
              <section className="hero">
                <div className="hero-copy">
                  <span className="hero-tag">
                    <span className="live-dot" />
                    {t("THE NEXT ADVENTURE", "ההרפתקה הבאה")}
                  </span>
                  <h2 dir="ltr">
                    Guatemala
                    <br />
                    <span>& Baja California</span>
                  </h2>
                  <p>
                    {t(
                      "Volcanic mornings. Ocean encounters. Everything in between.",
                      "בקרים וולקניים. מפגשים באוקיינוס. וכל מה שביניהם.",
                    )}
                  </p>
                  <div className="hero-bottom">
                    <span>
                      <CalendarDays size={16} />
                      {dateFmt(expedition.start)} — {dateFmt(expedition.end)},
                      {expedition.start.slice(0, 4)}
                    </span>
                    <span className="hero-divider" />
                    <span>
                      <Map size={16} />
                      {
                        new Set(
                          records.destinations
                            .map((d) => str(d, "country"))
                            .filter(Boolean),
                        ).size
                      }{" "}
                      {t("countries", "מדינות")} ·{" "}
                      {Math.round(
                        (Date.parse(expedition.end) -
                          Date.parse(expedition.start)) /
                          86400000,
                      ) + 1}{" "}
                      {t("days", "ימים")}
                    </span>
                  </div>
                  <button className="hero-link" onClick={() => go("segments")}>
                    {t("Explore your expedition", "לגלות את המסע שלך")}
                    <ArrowUpRight size={16} />
                  </button>
                </div>
                <div className="hero-art">
                  <div className="art-label">
                    <Compass size={15} />
                    14.5586° N, 90.7339° W
                  </div>
                  <div className="countdown">
                    <span>{t("DEPARTURE IN", "יוצאים בעוד")}</span>
                    <strong>
                      {days}
                      <small>{t("days", "ימים")}</small>
                    </strong>
                    <span>
                      {t("Let the countdown begin.", "הספירה לאחור התחילה.")}
                    </span>
                  </div>
                </div>
              </section>
              {cancellationAlerts(records.bookings, now).length > 0 && (
                <section className="cancellation-watch panel">
                  <div className="section-title">
                    <h2>
                      {t(
                        "Free cancellation is ending soon",
                        "ביטול חינם מסתיים בקרוב",
                      )}
                    </h2>
                    <button onClick={() => go("integrations")}>
                      {t("Reservation sync", "סנכרון הזמנות")}
                    </button>
                  </div>
                  {cancellationAlerts(records.bookings, now).map(
                    ({ booking }) => (
                      <button
                        className="action-row"
                        key={booking.id}
                        onClick={() => open("bookings", booking)}
                      >
                        <AlertTriangle size={17} />
                        <span>
                          <strong>{booking.title}</strong>
                          <small>
                            {str(booking, "freeCancellationLocal")} ·{" "}
                            {str(booking, "cancellationTimezone")}
                          </small>
                        </span>
                      </button>
                    ),
                  )}
                </section>
              )}
              <section className="stats">
                <button onClick={() => go("tasks")}>
                  <span className="stat-label">
                    <CheckSquare size={16} />
                    {t("Preparation", "מוכנות למסע")}
                  </span>
                  <strong>
                    {percent}
                    <small>%</small>
                  </strong>
                  <div className="progress">
                    <i style={{ width: percent + "%" }} />
                  </div>
                  <span className="stat-foot">
                    {prep} {t("of", "מתוך")} {records.tasks.length}{" "}
                    {t("tasks complete", "משימות הושלמו")}
                  </span>
                </button>
                <button onClick={() => go("expenses")}>
                  <span className="stat-label">
                    <Wallet size={16} />
                    {t("Budget remaining", "יתרת תקציב")}
                  </span>
                  <strong>{moneyFmt(total.remaining)}</strong>
                  <span className="stat-foot">
                    {t("of", "מתוך")} {moneyFmt(expedition.budget)} ·{" "}
                    {t("after commitments", "לאחר התחייבויות")}
                  </span>
                </button>
                <button onClick={() => go("bookings")}>
                  <span className="stat-label">
                    <Ticket size={16} />
                    {t("Bookings to arrange", "הזמנות לתכנון")}
                  </span>
                  <strong>
                    {bookingQueue.length.toString().padStart(2, "0")}
                    <small className="stat-pill">
                      {t("in planning", "בתכנון")}
                    </small>
                  </strong>
                  <span className="stat-foot">
                    {t(
                      "No assumed reservations",
                      "ללא הזמנות משוערות כמאושרות",
                    )}
                  </span>
                </button>
                <button onClick={() => go("decisions")}>
                  <span className="stat-label">
                    <Lightbulb size={16} />
                    {t("Open decisions", "החלטות פתוחות")}
                  </span>
                  <strong>
                    {records.decisions
                      .filter((x) => x.status !== "Decided")
                      .length.toString()
                      .padStart(2, "0")}
                  </strong>
                  <span className="stat-foot">
                    {t(
                      "A little research goes a long way",
                      "קצת מחקר עושה דרך ארוכה",
                    )}
                  </span>
                </button>
              </section>
              <div className="dashboard-grid">
                <section className="panel next-actions">
                  <div className="section-title">
                    <h2>{t("Make a little progress", "צעד קטן לקראת המסע")}</h2>
                    <button onClick={() => go("tasks")}>
                      {t("All tasks", "כל המשימות")}
                      <ArrowUpRight size={14} />
                    </button>
                  </div>
                  <p className="section-subtitle">
                    {t(
                      "A few things to move your adventure forward.",
                      "כמה דברים שיקדמו את ההרפתקה שלך.",
                    )}
                  </p>
                  {pending.slice(0, 4).map((task, i) => (
                    <button
                      key={task.id}
                      className="action-row"
                      onClick={() => open("tasks", task)}
                    >
                      <span className="action-number">0{i + 1}</span>
                      <span>
                        <strong>{task.title}</strong>
                        <small>
                          {str(task, "window")} · {str(task, "category")}
                        </small>
                      </span>
                      {badge(str(task, "priority"))}
                      <ArrowUpRight size={16} />
                    </button>
                  ))}
                  {pending.length === 0 && (
                    <p>
                      {t(
                        "All preparation tasks complete.",
                        "כל משימות ההכנה הושלמו.",
                      )}
                    </p>
                  )}
                </section>
                <section className="focus-card">
                  <div className="eyebrow">
                    <Sun size={15} />
                    {t("THE BIG REASON", "בשביל הרגע הזה")}
                  </div>
                  <div className="ray-art">
                    <svg viewBox="0 0 300 120" aria-hidden="true">
                      <path
                        d="M146 62 Q100 5 12 22 Q59 53 98 88 L144 70 L170 104 L167 69 Q221 107 287 27 Q210 5 155 58 L143 35 L137 39Z"
                        fill="currentColor"
                      />
                      <path
                        d="M145 67 Q147 95 135 119"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                    </svg>
                  </div>
                  <h2>{t("Chasing the mobulas.", "בעקבות המובולות.")}</h2>
                  <p>
                    {t(
                      "The Sea of Cortez is calling. Keep a few days open for a little ocean magic.",
                      "ים קורטז קורא לך. נשאיר כמה ימים פתוחים לקסם של האוקיינוס.",
                    )}
                  </p>
                  <button onClick={() => go("decisions")}>
                    {t("Plan the encounter", "לתכנון המפגש")}
                    <ArrowUpRight size={16} />
                  </button>
                  <small>
                    {t(
                      "Seasonal wildlife · sightings never guaranteed",
                      "חיות בר עונתיות · אין הבטחה לתצפיות",
                    )}
                  </small>
                </section>
              </div>
              <section className="route-section">
                <div className="section-title">
                  <div>
                    <h2>
                      {t("The shape of your adventure", "המסע מתחיל לקבל צורה")}
                    </h2>
                    <p className="section-subtitle">
                      {t(
                        "A direction, not a rigid schedule. All dates below are drafts.",
                        "כיוון, לא לוח זמנים קשיח. כל התאריכים כאן הם טיוטה.",
                      )}
                    </p>
                  </div>
                  <button onClick={() => go("segments")}>
                    {t("Build your route", "בניית המסלול")}
                    <ArrowUpRight size={14} />
                  </button>
                </div>
                <div className="route-cards">
                  {records.destinations.slice(0, 5).map((d, i) => (
                    <button
                      key={d.id}
                      className={"destination-card scene-" + i}
                      onClick={() => open("destinations", d)}
                    >
                      <div className="destination-art">
                        <span>{String(i + 1).padStart(2, "0")}</span>
                        {i < 3 ? (
                          <Mountain size={65} strokeWidth={0.8} />
                        ) : (
                          <Waves size={65} strokeWidth={0.8} />
                        )}
                      </div>
                      <div>
                        <small>{str(d, "country")}</small>
                        <h3>{d.title}</h3>
                        <span>
                          {t("Explore the plan", "לפרטי התכנון")}
                          <ArrowUpRight size={13} />
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
              <div className="journal-footer">
                <Compass size={17} />
                <span>
                  {t(
                    "Plan the logistics. Preserve the adventure.",
                    "לתכנן את הלוגיסטיקה. לשמור על ההרפתקה.",
                  )}
                </span>
                <span>ADVENTURE OS / {expedition.start.slice(0, 4)}</span>
              </div>
            </>
          )}
          {tab === "integrations" && (
            <ReservationIntegrations
              state={state}
              lang={lang}
              onRefresh={() =>
                loadWorkspace()
                  .then(setState)
                  .catch((e) => setError(e.message))
              }
            />
          )}
          {tab === "segments" && (
            <>
              <div className="tabs">
                <button className="selected">
                  {t("Primary itinerary", "מסלול ראשי")}
                </button>
                <button onClick={() => go("destinations")}>
                  {t("Destinations", "יעדים")}
                </button>
                <button onClick={() => go("scenarios")}>
                  {t("Budget scenarios", "תרחישי תקציב")}
                </button>
                <button
                  onClick={() => {
                    const id = crypto.randomUUID();
                    const title = prompt(
                      t("Draft scenario name", "שם תרחיש הטיוטה"),
                    );
                    if (!title) return;
                    persist({
                      ...state,
                      activeId: id,
                      expeditions: [
                        ...state.expeditions,
                        { ...expedition, id, title },
                      ],
                      records: {
                        ...state.records,
                        [id]: structuredClone(records),
                      },
                    });
                  }}
                >
                  {t("Duplicate as draft itinerary", "שכפול כתרחיש מסלול")}
                </button>
              </div>
              <div className="info">
                <Map size={17} />
                {t(
                  "Draft dates are flexible. Changes surface linked records for review; confirmed bookings are never moved automatically. Reordering changes sequence only.",
                  "תאריכי הטיוטה גמישים. שינוי מציג רשומות קשורות לבדיקה; הזמנות מאושרות אינן מוזזות אוטומטית. סידור מחדש משנה את הסדר בלבד.",
                )}
              </div>
              {list("segments")}
            </>
          )}
          {tab === "transport" && (
            <>
              <div className="info">
                <AlertTriangle size={17} />
                {t(
                  "Schedules, entry requirements, airport buffers and dive-to-flight intervals require verification. Unspecified connections are incomplete, not confirmed.",
                  "יש לאמת לוחות זמנים, תנאי כניסה, מרווחי טיסות וזמן מנוחה בין צלילה לטיסה. מעברים ללא פרטים אינם מאושרים.",
                )}
              </div>
              {warnings(records).length > 0 && (
                <details className="warning-panel">
                  <summary>
                    {warnings(records).length}{" "}
                    {t(
                      "connection checks need attention",
                      "בדיקות מעברים דורשות תשומת לב",
                    )}
                  </summary>
                  {warnings(records).map((w, i) => (
                    <p key={i}>{w}</p>
                  ))}
                </details>
              )}
              {list("transport")}
            </>
          )}
          {tab === "bookings" && (
            <>
              <div className="booking-queue">
                <span className="eyebrow">
                  {t("WHAT TO BOOK NEXT", "מה להזמין עכשיו")}
                </span>
                <h3>
                  {bookingQueue[0]?.title ||
                    t("All current bookings arranged", "כל ההזמנות טופלו")}
                </h3>
                <p>
                  {t(
                    "Prerequisites first, then earliest known date. Review availability sensitivity and cancellation flexibility with each provider.",
                    "תלויות תחילה, ואז התאריך הידוע הקרוב. יש לבדוק זמינות ותנאי ביטול מול כל ספק.",
                  )}
                </p>
                {bookingQueue[0] && (
                  <button onClick={() => open("bookings", bookingQueue[0])}>
                    {t("Review booking", "בדיקת ההזמנה")}
                    <ArrowUpRight size={14} />
                  </button>
                )}
              </div>
              {list("bookings")}
            </>
          )}
          {tab === "expenses" && (
            <>
              <section className="stats budget-stats">
                {[
                  [t("Forecast", "תחזית"), total.estimated],
                  [t("Committed", "התחייבויות"), total.committed],
                  [t("Booking payments", "תשלומי הזמנות"), total.paid],
                  [
                    t("Other actual spending", "הוצאות נוספות בפועל"),
                    total.actual,
                  ],
                ].map(([label, value]) => (
                  <button
                    key={String(label)}
                    onClick={() =>
                      go(
                        label ===
                          t("Other actual spending", "הוצאות נוספות בפועל")
                          ? "expenses"
                          : "bookings",
                      )
                    }
                  >
                    <span className="stat-label">{label}</span>
                    <strong>{moneyFmt(Number(value))}</strong>
                  </button>
                ))}
              </section>
              <div className="info">
                <Wallet size={17} />
                {t(
                  "Linked expenses are booking payments and never added twice. Rates are editable planning assumptions, not live rates. Remaining budget subtracts commitments and unlinked actual spending.",
                  "הוצאות המקושרות להזמנה הן תשלומים ואינן נספרות פעמיים. שערי ההמרה הם הנחות תכנון הניתנות לעריכה. היתרה מפחיתה התחייבויות והוצאות בפועל שאינן מקושרות.",
                )}
              </div>
              <div className="tabs">
                <button className="selected">{t("Expenses", "הוצאות")}</button>
                <button onClick={() => go("scenarios")}>
                  {t("Compare scenarios", "השוואת תרחישים")}
                </button>
                <button onClick={() => go("settings")}>
                  {t("Budget & exchange rates", "תקציב ושערי המרה")}
                </button>
              </div>
              <section className="panel category-breakdown">
                <h3>
                  {t(
                    "Booking forecast by category",
                    "תחזית הזמנות לפי קטגוריה",
                  )}
                </h3>
                {Array.from(
                  new Set(
                    records.bookings
                      .filter((x) => x.status !== "Cancelled")
                      .map((x) => str(x, "category") || "Other"),
                  ),
                ).map((c) => (
                  <div key={c}>
                    <span>{c}</span>
                    <strong>
                      {moneyFmt(
                        records.bookings
                          .filter(
                            (x) =>
                              x.status !== "Cancelled" &&
                              (str(x, "category") || "Other") === c,
                          )
                          .reduce((s, x) => s + cost(x, expedition), 0),
                      )}
                    </strong>
                  </div>
                ))}
              </section>
              {list("expenses")}
            </>
          )}
          {tab === "dives" && (
            <>
              <div className="tabs">
                <button className="selected">
                  {t("Dive log", "יומן צלילה")}
                </button>
                <button onClick={() => go("training")}>
                  {t("Trek training", "אימוני הליכה")}
                </button>
              </div>
              <div className="log-summary">
                <Waves size={30} />
                <div>
                  <strong>
                    {dive.count}{" "}
                    {t("actual logged dives", "צלילות מתועדות בפועל")}
                  </strong>
                  <p>
                    {t("Last actual dive", "צלילה אחרונה בפועל")}:{" "}
                    {dive.last
                      ? dateFmt(dive.last)
                      : t("Not logged yet", "טרם תועדה")}{" "}
                    ·{" "}
                    {t(
                      "Advanced Open Water / two-star",
                      "כוכב שני / Advanced Open Water",
                    )}
                  </p>
                </div>
              </div>
              <div className="info">
                <AlertTriangle size={18} />
                {t(
                  "Limited current experience. A projected 20–30 dives is not an actual log. Recent practice, comfort, conditions and operator requirements matter; this app does not certify dive readiness.",
                  "ניסיון מוגבל בזרמים. צפי של 20–30 צלילות אינו יומן בפועל. תרגול עדכני, נוחות, תנאים ודרישות המפעיל חשובים; האפליקציה אינה מאשרת כשירות לצלילה.",
                )}
              </div>
              {list("dives")}
            </>
          )}
          {tab === "training" && (
            <>
              <div className="info">
                <Mountain size={17} />
                {t(
                  "Return gradually after recovery. Track endurance, uphill walking, strength, stability and rest. Fitness does not prevent altitude sickness. No medical rehabilitation or clearance is provided here.",
                  "חזרה הדרגתית לאחר החלמה. מעקב אחר סיבולת, עליות, כוח, יציבות ומנוחה. כושר אינו מונע מחלת גבהים. אין כאן הנחיות שיקום או אישור רפואי.",
                )}
              </div>
              {list("training")}
            </>
          )}
          {tab === "decisions" && (
            <>
              <div className="tabs">
                <button className="selected">
                  {t("Open questions", "שאלות פתוחות")}
                </button>
                <button onClick={() => go("options")}>
                  {t("Compare research options", "השוואת אפשרויות")}
                </button>
              </div>
              {list("decisions")}
            </>
          )}
          {(
            [
              "tasks",
              "destinations",
              "gear",
              "options",
              "scenarios",
              "contacts",
            ] as Tab[]
          ).includes(tab) && (
            <>
              {tab === "scenarios" && (
                <div className="info">
                  {t(
                    "Scenarios add excursions to the current forecast without changing it. MXN 7,000/day is a planning ceiling, not a quotation. Compare rows below. Use itinerary duplication for route experiments.",
                    "תרחישים מוסיפים טיולים לתחזית הקיימת בלי לשנותה. 7,000 MXN ליום הם תקרת תכנון, לא הצעת מחיר. אפשר להשוות בין השורות. לניסויי מסלול יש לשכפל את המסע.",
                  )}
                </div>
              )}
              {list(tab as Kind)}
            </>
          )}
          {tab === "travel" && (
            <>
              <div className="travel-banner">
                <Navigation size={32} />
                <div>
                  <h2>
                    {t("Less screen. More world.", "פחות מסך. יותר עולם.")}
                  </h2>
                  <p>
                    {t(
                      cloudMode
                        ? "Your essential details, in one place. Export a backup before traveling offline."
                        : "Your essential details, in one place. Cached records remain readable offline after opening this app.",
                      cloudMode
                        ? "כל הפרטים החשובים במקום אחד. מומלץ לייצא גיבוי לפני נסיעה ללא רשת."
                        : "כל הפרטים החשובים במקום אחד. רשומות שנטענו זמינות מהמטמון כשהשרת אינו זמין.",
                    )}
                  </p>
                </div>
                <input
                  aria-label="Travel date"
                  type="date"
                  value={travelDate}
                  onChange={(e) => setTravelDate(e.target.value)}
                />
              </div>
              {(["segments", "bookings", "transport"] as Kind[]).map((k) => (
                <section className="panel travel-panel" key={k}>
                  <h2>
                    {t(
                      k === "segments"
                        ? "Today’s plan"
                        : k === "bookings"
                          ? "Accommodation & activities"
                          : "Next connections",
                      k === "segments"
                        ? "התוכנית היומית"
                        : k === "bookings"
                          ? "לינה ופעילויות"
                          : "המעברים הבאים",
                    )}
                  </h2>
                  {records[k]
                    .filter(
                      (r) =>
                        r.status !== "Cancelled" &&
                        !!r.date &&
                        (k === "transport"
                          ? str(r, "date") >= travelDate
                          : str(r, "date") <= travelDate &&
                            (str(r, "end") || str(r, "date")) >= travelDate),
                    )
                    .slice(0, 6)
                    .map((r) => (
                      <button
                        key={r.id}
                        className="travel-row"
                        onClick={() => open(k, r)}
                      >
                        <strong>{r.title}</strong>
                        {badge(r.status)}
                        <span>
                          {str(r, "departure") || str(r, "date")}{" "}
                          {str(r, "reference")}
                        </span>
                        {r.stayAddress && (
                          <p className="stay-address">
                            {str(r, "stayAddress")}
                          </p>
                        )}
                        {r.freeCancellationAt && (
                          <p>
                            {t("Free cancellation until", "ביטול חינם עד")}{" "}
                            {str(r, "freeCancellationLocal")} ·{" "}
                            {str(r, "cancellationTimezone")}
                          </p>
                        )}
                        <p>{str(r, "notes")}</p>
                      </button>
                    ))}
                  {!records[k].some(
                    (r) =>
                      r.date &&
                      str(r, "date") <= travelDate &&
                      (str(r, "end") || str(r, "date")) >= travelDate,
                  ) && (
                    <p className="muted">
                      {t(
                        "No confirmed details for this day. Add them when known.",
                        "אין פרטים מאושרים ליום זה. ניתן להוסיף כשיהיו ידועים.",
                      )}
                    </p>
                  )}
                </section>
              ))}
              <div className="tabs">
                <button onClick={() => go("contacts")}>
                  {t("Emergency contacts", "אנשי קשר לחירום")}
                </button>
                <button
                  onClick={() =>
                    downloadBackup().catch((e) => setError(e.message))
                  }
                >
                  <Download size={15} />
                  {t("Download offline backup", "הורדת גיבוי מקומי")}
                </button>
              </div>
              <p className="muted">
                <CloudOff size={14} />{" "}
                {t(
                  "Backup files contain personal data. Store them privately. Offline cold launch is not yet supported.",
                  "קובצי הגיבוי מכילים מידע אישי. יש לשמור אותם באופן פרטי. פתיחה ראשונית ללא רשת טרם נתמכת.",
                )}
              </p>
            </>
          )}
          {tab === "settings" && (
            <section className="panel settings-panel">
              <h2>{t("Make this expedition yours", "המסע הזה הוא שלך")}</h2>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const data = new FormData(e.currentTarget);
                  const next = {
                    ...expedition,
                    title: String(data.get("title")),
                    start: String(data.get("start")),
                    end: String(data.get("end")),
                    budget: Number(data.get("budget")),
                    rates: Object.fromEntries(
                      ["ILS", "USD", "GTQ", "MXN", "EUR"].map((c) => [
                        c,
                        Number(data.get(c)),
                      ]),
                    ),
                  };
                  if (next.end < next.start) {
                    setError("End date must follow start date");
                    return;
                  }
                  await persist({
                    ...state,
                    expeditions: state.expeditions.map((x) =>
                      x.id === next.id ? next : x,
                    ),
                  });
                }}
              >
                <div className="form-grid">
                  <label>
                    {t("Expedition name", "שם המסע")}
                    <input
                      name="title"
                      defaultValue={expedition.title}
                      required
                    />
                  </label>
                  <label>
                    {t("Budget target (ILS)", "יעד תקציב בש״ח")}
                    <input
                      name="budget"
                      type="number"
                      min="1"
                      defaultValue={expedition.budget}
                      required
                    />
                  </label>
                  <label>
                    {t("Departure", "יציאה")}
                    <input
                      name="start"
                      type="date"
                      defaultValue={expedition.start}
                      required
                    />
                  </label>
                  <label>
                    {t("Return", "חזרה")}
                    <input
                      name="end"
                      type="date"
                      defaultValue={expedition.end}
                      required
                    />
                  </label>
                </div>
                <h3>
                  {t(
                    "Planning rates · ILS per currency unit",
                    "שערי תכנון · ש״ח ליחידת מטבע",
                  )}
                </h3>
                <p className="muted">
                  {t(
                    "Illustrative, not live rates. Verify and update before making decisions.",
                    "שערים להמחשה בלבד. יש לאמת ולעדכן לפני החלטות.",
                  )}
                </p>
                <div className="rates">
                  {["ILS", "USD", "GTQ", "MXN", "EUR"].map((c) => (
                    <label key={c}>
                      {c}
                      <input
                        name={c}
                        type="number"
                        step="0.0001"
                        min="0.0001"
                        required
                        defaultValue={expedition.rates[c]}
                        readOnly={c === "ILS"}
                      />
                    </label>
                  ))}
                </div>
                <button className="primary" disabled={busy}>
                  {t("Save settings", "שמירת הגדרות")}
                </button>
              </form>
              <hr />
              <div className="settings-actions">
                <button
                  className="secondary"
                  onClick={() =>
                    downloadBackup().catch((e) => setError(e.message))
                  }
                >
                  <Download size={16} />
                  {t("Export full backup", "ייצוא גיבוי מלא")}
                </button>
                <label className="secondary import-label">
                  {t("Restore JSON backup", "שחזור גיבוי JSON")}
                  <input
                    type="file"
                    accept="application/json"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        const data = JSON.parse(await file.text());
                        if (
                          confirm(
                            t(
                              "Replace all expedition data with this backup?",
                              "להחליף את כל נתוני המסעות בגיבוי זה?",
                            ),
                          )
                        )
                          await persist({ ...data, revision: state.revision });
                      } catch {
                        setError("Invalid backup file");
                      }
                      e.target.value = "";
                    }}
                  />
                </label>
                <button
                  className="secondary"
                  onClick={() => {
                    const title = prompt(
                      t("New expedition name", "שם המסע החדש"),
                    );
                    if (!title) return;
                    const id = crypto.randomUUID();
                    persist({
                      ...state,
                      activeId: id,
                      expeditions: [
                        ...state.expeditions,
                        {
                          id,
                          title,
                          start: "2027-01-01",
                          end: "2027-01-07",
                          budget: 25000,
                          rates: expedition.rates,
                        },
                      ],
                      records: {
                        ...state.records,
                        [id]: newExpeditionRecords(state),
                      },
                    });
                  }}
                >
                  <Plus size={16} />
                  {t("New expedition", "מסע חדש")}
                </button>
              </div>
              <p className="muted">
                {t(
                  cloudMode
                    ? "Your workspace is private to your Supabase account. Export a backup before major changes. Documents are linked, not uploaded."
                    : "Local single-user edition. No authentication configured. Do not expose this server publicly or store sensitive document files here.",
                  cloudMode
                    ? "סביבת העבודה פרטית לחשבון Supabase שלך. מומלץ לייצא גיבוי לפני שינויים גדולים. מסמכים מקושרים ואינם מועלים."
                    : "מהדורה מקומית למשתמש יחיד. אימות משתמשים אינו מוגדר. אין לחשוף את השרת לציבור או לשמור כאן מסמכים רגישים.",
                )}
              </p>
            </section>
          )}
        </main>
      </div>
      {editor && (
        <div className="modal-backdrop" onClick={() => setEditor(null)}>
          <section
            className="editor"
            role="dialog"
            aria-modal="true"
            aria-labelledby="editor-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="editor-header">
              <div>
                <span className="eyebrow">ADVENTURE OS / {editor.kind}</span>
                <h2 id="editor-title">
                  {editor.record.title ||
                    t("A new piece of the plan", "עוד חלק בתוכנית")}
                </h2>
              </div>
              <button
                className="icon-button"
                onClick={() => setEditor(null)}
                aria-label="Close"
              >
                <X size={21} />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (
                  editor.record.date &&
                  editor.record.end &&
                  str(editor.record, "date") > str(editor.record, "end")
                ) {
                  setError(
                    t(
                      "End must follow start date.",
                      "תאריך הסיום צריך להיות אחרי ההתחלה.",
                    ),
                  );
                  return;
                }
                if (
                  editor.kind === "bookings" &&
                  num(editor.record, "paid") > num(editor.record, "amount")
                ) {
                  setError(
                    t(
                      "Payments exceed the total booking cost.",
                      "התשלומים גבוהים מעלות ההזמנה.",
                    ),
                  );
                  return;
                }
                const old = records[editor.kind].find(
                  (r) => r.id === editor.record.id,
                );
                const changed =
                  old &&
                  (old.date !== editor.record.date ||
                    old.end !== editor.record.end);
                if (
                  changed &&
                  ["segments", "destinations"].includes(editor.kind)
                ) {
                  const affected = impacts(editor.record, records);
                  if (affected.length || old.locked) {
                    setImpact({ record: editor.record, affected });
                    return;
                  }
                }
                saveRecord(editor.kind, editor.record);
              }}
            >
              <div className="form-grid">
                {fields[editor.kind].map((field) => {
                  let opts =
                    field.options?.map((v) => ({
                      value: v,
                      label: statusLabel(v),
                    })) || [];
                  if (
                    [
                      "destination",
                      "booking",
                      "decision",
                      "dependencies",
                    ].includes(field.type || "")
                  ) {
                    const linked =
                      field.type === "destination"
                        ? records.destinations
                        : field.type === "booking"
                          ? records.bookings
                          : field.type === "decision"
                            ? records.decisions
                            : editor.kind === "tasks"
                              ? records.tasks
                              : [
                                  ...records.bookings,
                                  ...records.transport,
                                  ...records.segments,
                                ];
                    opts = linked
                      .filter((x) => x.id !== editor.record.id)
                      .map((r) => ({ value: r.id, label: r.title }));
                  }
                  return (
                    <label
                      key={field.key}
                      className={
                        field.type === "textarea"
                          ? "full"
                          : field.type === "checkbox"
                            ? "checkbox-field"
                            : ""
                      }
                    >
                      {t(field.en, field.he)}
                      {field.type === "textarea" ? (
                        <textarea
                          value={str(editor.record, field.key)}
                          onChange={(e) =>
                            setEditor({
                              ...editor,
                              record: {
                                ...editor.record,
                                ...([
                                  "freeCancellationLocal",
                                  "cancellationTimezone",
                                  "cancellationPolicy",
                                ].includes(field.key)
                                  ? { cancellationVerified: false }
                                  : {}),
                                [field.key]: e.target.value,
                              },
                            })
                          }
                          rows={3}
                        />
                      ) : field.type === "checkbox" ? (
                        <input
                          type="checkbox"
                          checked={!!editor.record[field.key]}
                          onChange={(e) =>
                            setEditor({
                              ...editor,
                              record: {
                                ...editor.record,
                                ...([
                                  "freeCancellationLocal",
                                  "cancellationTimezone",
                                  "cancellationPolicy",
                                ].includes(field.key)
                                  ? { cancellationVerified: false }
                                  : {}),
                                [field.key]: e.target.checked,
                              },
                            })
                          }
                        />
                      ) : [
                          "select",
                          "destination",
                          "booking",
                          "decision",
                          "dependencies",
                        ].includes(field.type || "") ? (
                        <select
                          aria-label={t(field.en, field.he)}
                          multiple={field.type === "dependencies"}
                          value={
                            field.type === "dependencies"
                              ? Array.isArray(editor.record[field.key])
                                ? (editor.record[field.key] as string[])
                                : []
                              : str(editor.record, field.key)
                          }
                          onChange={(e) =>
                            setEditor({
                              ...editor,
                              record: {
                                ...editor.record,
                                ...([
                                  "freeCancellationLocal",
                                  "cancellationTimezone",
                                  "cancellationPolicy",
                                ].includes(field.key)
                                  ? { cancellationVerified: false }
                                  : {}),
                                [field.key]:
                                  field.type === "dependencies"
                                    ? Array.from(e.target.selectedOptions).map(
                                        (o) => o.value,
                                      )
                                    : e.target.value,
                              },
                            })
                          }
                        >
                          {field.type !== "dependencies" && (
                            <option value="">—</option>
                          )}
                          {opts.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          autoFocus={field.key === "title"}
                          required={field.key === "title"}
                          type={field.type}
                          min={
                            field.type === "number" && field.key !== "extra"
                              ? 0
                              : undefined
                          }
                          step={field.type === "number" ? "any" : undefined}
                          value={str(editor.record, field.key)}
                          onChange={(e) =>
                            setEditor({
                              ...editor,
                              record: {
                                ...editor.record,
                                ...([
                                  "freeCancellationLocal",
                                  "cancellationTimezone",
                                  "cancellationPolicy",
                                ].includes(field.key)
                                  ? { cancellationVerified: false }
                                  : {}),
                                [field.key]:
                                  field.type === "number"
                                    ? e.target.value === ""
                                      ? ""
                                      : Number(e.target.value)
                                    : e.target.value,
                              },
                            })
                          }
                        />
                      )}
                    </label>
                  );
                })}
              </div>
              <div className="editor-footer">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setEditor(null)}
                >
                  {t("Cancel", "ביטול")}
                </button>
                <button className="primary" disabled={busy}>
                  <Check size={16} />
                  {busy
                    ? t("Saving…", "שומר…")
                    : t("Save record", "שמירת רשומה")}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
      {impact && (
        <div className="modal-backdrop impact-backdrop">
          <section
            className="editor impact-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="impact-title"
          >
            <AlertTriangle size={30} />
            <h2 id="impact-title">
              {t("Review the ripple effect", "בדיקת השפעת השינוי")}
            </h2>
            <p>
              {t(
                "Save this date change only? Linked and confirmed records stay unchanged. Review them individually before finalizing your route.",
                "לשמור רק את שינוי התאריכים הזה? רשומות מקושרות והזמנות מאושרות לא ישתנו. יש לבדוק אותן בנפרד לפני סגירת המסלול.",
              )}
            </p>
            {impact.affected.map((r) => (
              <div className="impact-row" key={r.id}>
                {r.title}
                {badge(r.status)}
              </div>
            ))}
            <div className="editor-footer">
              <button className="secondary" onClick={() => setImpact(null)}>
                {t("Keep editing", "המשך עריכה")}
              </button>
              <button
                className="primary"
                disabled={busy}
                onClick={() => saveRecord(editor!.kind, impact.record)}
              >
                {t("Confirm this change only", "אישור השינוי הזה בלבד")}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
