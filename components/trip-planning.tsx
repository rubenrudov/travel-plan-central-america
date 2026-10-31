"use client";
import { useState } from "react";
import {
  CalendarDays,
  Check,
  Download,
  Fish,
  LockKeyhole,
  Move,
  Pencil,
  Archive,
  ArrowLeft,
} from "lucide-react";
import { State, Entry, Kind, str, num, totals, readiness } from "@/lib/model";
import {
  PLAN_VERSION,
  bookingWindows,
  plan2027Update,
  tripBlueprint,
} from "@/lib/expedition-2027";
import {
  bookingStatusLabels,
  isActive,
  isExistingBooking,
  missingConfirmation,
} from "@/lib/booking-status";
import {
  marineSafety,
  shiftStation,
  taskBlockers,
  tripCalendar,
  urgentTasks,
} from "@/lib/trip-planning";
import { cancellationAlerts } from "@/lib/reservations";
import { downloadBackup } from "@/lib/client-store";
type Props = {
  state: State;
  onSave: (state: State) => Promise<boolean>;
  onOpen: (kind: Kind, record: Entry) => void;
};
const dateLabel = (date: string) =>
  date
    ? new Intl.DateTimeFormat("he-IL", {
        day: "numeric",
        month: "short",
        timeZone: "UTC",
      }).format(new Date(date + "T12:00:00Z"))
    : "טרם נקבע";
const money = (amount: number) =>
  new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 0,
  }).format(amount);

export function PlanUpdate({ state, onSave }: Pick<Props, "state" | "onSave">) {
  const [review, setReview] = useState(false),
    [backupRevision, setBackupRevision] = useState(-1),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const expedition = state.expeditions.find((e) => e.id === state.activeId)!;
  if (expedition.planVersion === PLAN_VERSION) return null;
  if (
    !/guatemala|baja|גואטמלה/i.test(`${expedition.id} ${expedition.title}`) &&
    !(expedition.start === "2027-04-17" && expedition.end === "2027-05-20")
  )
    return null;
  const old = state.records[state.activeId],
    next = plan2027Update(state),
    after = next.records[next.activeId];
  const archived = (Object.keys(old) as Kind[]).reduce(
    (sum, k) =>
      sum +
      after[k].filter(
        (x) => x.archived && !old[k].find((y) => y.id === x.id)?.archived,
      ).length,
    0,
  );
  return (
    <section
      className="panel trip-upgrade"
      dir="rtl"
      aria-label="עדכון תוכנית המסע"
    >
      <div className="section-title">
        <h2>התוכנית המעודכנת: גואטמלה ומקסיקו 2027</h2>
        <button className="secondary" onClick={() => setReview(!review)}>
          {review ? "סגירת התצוגה" : "בדיקת עדכון המסע"}
          <ArrowLeft size={16} />
        </button>
      </div>
      <p>
        17 באפריל–20 במאי · טבע, ים וחופש בשטח. העדכון שומר הזמנות ותשלומים
        קיימים ומעביר טיוטות ישנות לארכיון.
      </p>
      {review && (
        <div className="trip-review">
          <p>
            יתווספו {tripBlueprint().segments.length} תחנות ו־
            {tripBlueprint().tasks.length} משימות בעברית. {archived} רשומות
            טיוטה יישמרו בארכיון. יעד התקציב ושערי ההמרה השמורים שלך יישמרו, לצד
            טווח היעד 20,000–25,000 ש״ח.
          </p>
          <p>
            זוהו בחשבון זה {old.bookings.filter(isExistingBooking).length}{" "}
            הזמנות קיימות לפי הסטטוס השמור;{" "}
            {old.bookings.filter((b) => b.reference).length} רשומות עם מספר
            אישור. פרטי לינה שדווחו ללא אישור יוצגו להשלמה, ולא כהזמנות מאומתות.
          </p>
          <p>
            תחנות נעולות או מאושרות לא יוזזו. אם הן חופפות להצעה החדשה, הן
            יופיעו ביומן לבדיקה.
          </p>
          {error && (
            <p role="alert" className="alert">
              {error}
            </p>
          )}
          <div className="settings-actions">
            <button
              className="secondary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  const backup = await downloadBackup();
                  if (backup.revision !== state.revision)
                    throw Error("הנתונים השתנו. יש לרענן לפני החלת העדכון.");
                  setBackupRevision(backup.revision);
                } catch (e) {
                  setError(e instanceof Error ? e.message : "הגיבוי לא הושלם");
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Download size={16} />
              הורדת גיבוי לפני העדכון
            </button>
            <button
              className="primary"
              disabled={busy || backupRevision !== state.revision}
              onClick={async () => {
                setBusy(true);
                try {
                  await onSave(next);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Check size={16} />
              החלת התוכנית ושמירת ההיסטוריה
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

export function BookingCenter({ state, onSave, onOpen }: Props) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const records = state.records[state.activeId];
  const patchTask = async (
    task: Entry,
    patch: Record<string, Entry[string]>,
  ) => {
    if (patch.status === "Done" && taskBlockers(task, records).length) {
      setError("יש להשלים או לעדכן את המשימות התלויות לפני סימון השלמה.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      await onSave({
        ...state,
        records: {
          ...state.records,
          [state.activeId]: {
            ...records,
            tasks: records.tasks.map((t) =>
              t.id === task.id ? { ...t, ...patch } : t,
            ),
          },
        },
      });
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="trip-booking-center" dir="rtl">
      <div className="info">
        <CalendarDays size={20} />
        <span>
          מועדי היעד הם המלצות לתכנון, לא מועדי סגירה שהתקבלו מספק. הזמנה עם
          ביטול חינם היא הזמנה קיימת; אין צורך להזמין אותה מחדש.
        </span>
      </div>
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
      {[
        ...bookingWindows,
        ...(records.tasks.some(
          (t) => !t.archived && !t.bookingWindow && t.status !== "Cancelled",
        )
          ? [{ id: "other", title: "משימות נוספות שנשמרו", date: "" }]
          : []),
      ].map((window) => (
        <details
          className="panel trip-window"
          key={window.id}
          open={window.id === "now"}
        >
          <summary className="section-title">
            <h2>{window.title}</h2>
            <span className="badge">
              {window.id === "spontaneous" ? "חופש בשטח" : "מועד מומלץ בלבד"}
            </span>
          </summary>
          {records.tasks
            .filter(
              (t) =>
                !t.archived &&
                (t.bookingWindow === window.id ||
                  (window.id === "other" && !t.bookingWindow)) &&
                t.status !== "Cancelled",
            )
            .map((task) => {
              const destination = records.destinations.find(
                (d) => d.id === task.destinationId,
              );
              const blockers = taskBlockers(task, records);
              return (
                <article className="trip-task" key={task.id}>
                  <div className="trip-task-copy">
                    <button
                      className="record-title"
                      onClick={() => onOpen("tasks", task)}
                    >
                      {task.title}
                    </button>
                    <p>
                      {destination?.title || "לכל המסע"} ·{" "}
                      {task.priority === "High"
                        ? "עדיפות גבוהה"
                        : "עדיפות רגילה"}{" "}
                      ·{" "}
                      {task.status === "Done"
                        ? "הושלם"
                        : task.status === "Deferred"
                          ? "נדחה"
                          : task.status === "In progress"
                            ? "בתהליך"
                            : "לביצוע"}
                    </p>
                    <p>
                      {task.postponedUntil
                        ? `נדחה עד ${dateLabel(str(task, "postponedUntil"))}`
                        : task.date
                          ? `תאריך יעד מומלץ: ${dateLabel(str(task, "date"))}`
                          : "לפי התנאים במהלך המסע"}{" "}
                      · {str(task, "recommendation")}
                    </p>
                    {task.routeStart && (
                      <p>
                        תחילת התחנה במסלול: {dateLabel(str(task, "routeStart"))}
                      </p>
                    )}
                    {Array.isArray(task.dependencies) &&
                      task.dependencies.length > 0 &&
                      blockers.length === 0 && (
                        <p>
                          התלויות הושלמו:{" "}
                          {task.dependencies
                            .map(
                              (id) =>
                                records.tasks.find((t) => t.id === id)?.title ||
                                records.bookings.find((b) => b.id === id)
                                  ?.title ||
                                id,
                            )
                            .join("; ")}
                        </p>
                      )}
                    {blockers.length > 0 && (
                      <p className="trip-caution">
                        תלוי ב־
                        {blockers
                          .map(
                            (id) =>
                              records.tasks.find((t) => t.id === id)?.title ||
                              records.bookings.find((b) => b.id === id)
                                ?.title ||
                              "קישור חסר — יש לבדוק",
                          )
                          .join("; ")}
                      </p>
                    )}
                    {(task.budgetMin || task.budgetMax) && (
                      <p>
                        טווח תקציב לתכנון:{" "}
                        {str(task, "budgetMin") || "טרם נקבע"}–
                        {str(task, "budgetMax") || "טרם נקבע"}{" "}
                        {str(task, "currency")}
                      </p>
                    )}
                    {/^https?:\/\//.test(str(task, "source")) && (
                      <a
                        className="source"
                        href={str(task, "source")}
                        target="_blank"
                        rel="noreferrer"
                      >
                        מידע נוסף מהמקור השמור
                      </a>
                    )}
                  </div>
                  <div className="trip-task-controls">
                    <button
                      className="secondary"
                      disabled={
                        busy || task.status === "Done" || blockers.length > 0
                      }
                      onClick={() => patchTask(task, { status: "Done" })}
                    >
                      <Check size={16} />
                      סימון השלמה
                    </button>
                    <label>
                      שינוי סטטוס
                      <select
                        aria-label={`סטטוס: ${task.title}`}
                        disabled={busy}
                        value={task.status}
                        onChange={(e) =>
                          patchTask(task, { status: e.target.value })
                        }
                      >
                        <option value="Todo">לביצוע</option>
                        <option value="In progress">בתהליך</option>
                        <option value="Done">הושלם</option>
                        <option value="Deferred">נדחה</option>
                      </select>
                    </label>
                    <label>
                      דחייה עד
                      <input
                        type="date"
                        aria-label={`דחייה: ${task.title}`}
                        value={str(task, "postponedUntil")}
                        disabled={busy}
                        onChange={(e) =>
                          patchTask(task, {
                            postponedUntil: e.target.value,
                            status: e.target.value ? "Deferred" : "Todo",
                          })
                        }
                      />
                    </label>
                  </div>
                </article>
              );
            })}
        </details>
      ))}
      {records.bookings.some((b) => isActive(b) && missingConfirmation(b)) && (
        <div className="panel trip-missing">
          <h3>פרטי אישור חסרים</h3>
          <p>
            ההזמנות האלו קיימות לפי הדיווח או הסטטוס השמור. השלימו תאריכים, ספק
            ואסמכתה לפני הסתמכות על הפרטים.
          </p>
          {records.bookings
            .filter((b) => isActive(b) && missingConfirmation(b))
            .map((b) => (
              <button
                className="secondary"
                key={b.id}
                onClick={() => onOpen("bookings", b)}
              >
                <Pencil size={16} />
                השלמת אישור: {b.title}
              </button>
            ))}
        </div>
      )}
    </section>
  );
}

export function TripTimeline({ state, onSave, onOpen }: Props) {
  const [chosen, setChosen] = useState<Record<string, string>>({}),
    [proposal, setProposal] = useState<{
      next: State;
      title: string;
      date: string;
    } | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const records = state.records[state.activeId],
    expedition = state.expeditions.find((e) => e.id === state.activeId)!;
  const days = tripCalendar(records, expedition),
    stations = records.segments
      .filter(isActive)
      .sort((a, b) => str(a, "date").localeCompare(str(b, "date")));
  const propose = (id: string, date: string) => {
    try {
      const next = shiftStation(state, id, date);
      setProposal({
        next,
        title: records.segments.find((s) => s.id === id)!.title,
        date,
      });
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "לא ניתן להזיז את התחנה");
    }
  };
  return (
    <section className="trip-timeline" dir="rtl">
      <div className="section-title">
        <h2>
          יומן המסע · {dateLabel(expedition.start)}–{dateLabel(expedition.end)}
        </h2>
        <span className="badge">
          {days.filter((d) => d.locked).length} ימים נעולים ·{" "}
          {days.filter((d) => !d.locked).length} ימים גמישים
        </span>
      </div>
      <p className="muted">
        לינה נבדקת כלילה שבין צ׳ק־אין לצ׳ק־אאוט. יום החזרה אינו דורש לינת המשך.
        ימים פתוחים הם מרחב רצוי לשינויים; לינה חסרה פירושה שאין אישור מתוארך
        שמור.
      </p>
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
      {proposal && (
        <div
          className="panel trip-shift-review"
          role="region"
          aria-label="בדיקת שינוי מסלול"
        >
          <h3>בדיקת שינוי: {proposal.title}</h3>
          <p>
            התחנה תתחיל ב־{dateLabel(proposal.date)}. משימות המלצה המקושרות אליה
            יעודכנו; תאריכים שנערכו ידנית ומשימות שהושלמו לא ישתנו. הזמנות
            וטיסות שמורות יישארו בתאריכים המקוריים ויש לבדוק את התאמתן.
          </p>
          <div className="settings-actions">
            <button
              className="primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  if (await onSave(proposal.next)) setProposal(null);
                } finally {
                  setBusy(false);
                }
              }}
            >
              אישור שינוי התחנה בלבד
            </button>
            <button className="secondary" onClick={() => setProposal(null)}>
              ביטול השינוי
            </button>
          </div>
        </div>
      )}
      <p className="muted">
        במחשב אפשר לגרור תחנה גמישה ליום ביומן. בטלפון ניתן לבחור תאריך בכרטיס
        התחנה. כל שינוי מוצג לבדיקה לפני שמירה.
      </p>
      <div className="trip-planner-body">
        <div className="trip-stations">
          {stations.map((s) => {
            const locked =
              !!s.locked || ["Confirmed", "Booked", "Paid"].includes(s.status);
            return (
              <article
                className={`panel trip-station ${locked ? "is-locked" : "is-flexible"}`}
                key={s.id}
                draggable={!locked}
                onDragStart={(e) =>
                  e.dataTransfer.setData("application/adventure-station", s.id)
                }
              >
                <div className="section-title">
                  <button
                    className="record-title"
                    aria-label={`עריכת תחנה: ${s.title}`}
                    onClick={() => onOpen("segments", s)}
                  >
                    {s.title}
                  </button>
                  <span className="badge">
                    {locked ? <LockKeyhole size={13} /> : <Move size={13} />}
                    {locked
                      ? "תאריכים נעולים"
                      : s.planningFixed
                        ? "תחנה קבועה לתכנון · אישור חסר"
                        : "תחנה מוצעת וגמישה"}
                  </span>
                </div>
                <p>
                  {dateLabel(str(s, "date"))}–{dateLabel(str(s, "end"))} ·{" "}
                  {str(s, "notes")}
                </p>
                {!locked && (
                  <div className="trip-shift-controls">
                    <button
                      className="secondary trip-drag-handle"
                      draggable
                      aria-label={`גרירת תחנה ליומן: ${s.title}`}
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData(
                          "application/adventure-station",
                          s.id,
                        );
                        event.dataTransfer.setData("text/plain", s.id);
                      }}
                      onClick={(event) =>
                        event.currentTarget.parentElement
                          ?.querySelector("input")
                          ?.focus()
                      }
                    >
                      <Move size={16} /> גרירה ליומן
                    </button>
                    <label>
                      תחילת התחנה
                      <input
                        type="date"
                        aria-label={`תחילת תחנה: ${s.title}`}
                        value={chosen[s.id] || str(s, "date")}
                        min={expedition.start}
                        max={expedition.end}
                        onChange={(e) =>
                          setChosen({ ...chosen, [s.id]: e.target.value })
                        }
                      />
                    </label>
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={() =>
                        propose(s.id, chosen[s.id] || str(s, "date"))
                      }
                    >
                      <Move size={16} />
                      בדיקת הזזת תחנה
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
        <div className="trip-day-grid">
          {days.map((day) => (
            <article
              className={`trip-day ${day.locked ? "is-locked" : ""}`}
              key={day.date}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData(
                  "application/adventure-station",
                );
                if (id) propose(id, day.date);
              }}
            >
              <h3>
                <CalendarDays size={16} />
                {dateLabel(day.date)}
                {day.locked && <LockKeyhole size={14} />}
              </h3>
              {day.stations.length ? (
                day.stations.map((s) => (
                  <button
                    key={s.id}
                    aria-label={`תחנה ביום ${day.date}: ${s.title}`}
                    onClick={() => onOpen("segments", s)}
                  >
                    {s.title}
                  </button>
                ))
              ) : (
                <p className="trip-open-day">יום פתוח — מקום לחופש ולמעברים</p>
              )}
              {day.transfers.map((t) => (
                <button
                  className="trip-transfer"
                  key={t.id}
                  onClick={() => onOpen("transport", t)}
                >
                  {t.title} ·{" "}
                  {isExistingBooking(t) ? "לפי הסטטוס השמור" : "טרם הוזמן"}
                </button>
              ))}
              {day.bookings.map((b) => (
                <button
                  className="trip-calendar-booking"
                  key={b.id}
                  onClick={() => onOpen("bookings", b)}
                >
                  {b.title} ·{" "}
                  {bookingStatusLabels[b.status] || "לפי הסטטוס השמור"}
                </button>
              ))}
              {day.reported.length > 0 && (
                <p className="trip-caution">
                  לינה דווחה ביעד; פרטי האישור והתאריכים חסרים
                </p>
              )}
              {day.missingLodging && (
                <p className="trip-caution">לילה ללא אישור לינה מתוארך</p>
              )}
              {day.transfers.some((t) => !t.departure || !t.arrival) && (
                <p className="trip-caution">
                  מעבר ללא שעות מאומתות — יש לבדוק זמני נסיעה ומרווחי המשך
                </p>
              )}
              {day.overlappingLodging && (
                <p className="trip-caution">חפיפת הזמנות לינה — יש לבדוק</p>
              )}
              {day.stationOverlap && (
                <p className="trip-caution">
                  חפיפת תחנות ביעדים שונים — יש לבדוק מעבר
                </p>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function MarineCenter({ state, onSave, onOpen }: Props) {
  const [busy, setBusy] = useState(false);
  const expedition = state.expeditions.find((e) => e.id === state.activeId)!,
    records = state.records[state.activeId];
  const profile = readiness(records.dives),
    checks = marineSafety(records);
  return (
    <section className="trip-marine" dir="rtl">
      <section className="panel">
        <div className="section-title">
          <h2>
            <Fish size={22} />
            הרפתקאות ימיות
          </h2>
          <span className="badge">מפגשים עם חיות בר אינם מובטחים</span>
        </div>
        <p>
          לה פאס · לה ונטנה / אל סרגנטו · קאבו פולמו. יציאות עם מפעילים מורשים,
          התאמה לניסיון ושמירה על כללי הגנת חיות הבר.
        </p>
        <form
          className="form-grid"
          key={`${state.activeId}-${expedition.certification}-${expedition.currentExperience}`}
          onSubmit={async (e) => {
            e.preventDefault();
            const fields = new FormData(e.currentTarget);
            setBusy(true);
            try {
              await onSave({
                ...state,
                expeditions: state.expeditions.map((x) =>
                  x.id === state.activeId
                    ? {
                        ...x,
                        certification: String(fields.get("certification")),
                        currentExperience: String(fields.get("experience")),
                      }
                    : x,
                ),
              });
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            הסמכה לפי הדיווח
            <input
              name="certification"
              defaultValue={expedition.certification || ""}
            />
          </label>
          <label>
            ניסיון והכנות
            <input
              name="experience"
              defaultValue={expedition.currentExperience || ""}
            />
          </label>
          <button className="secondary" disabled={busy}>
            שמירת פרופיל הצלילה
          </button>
        </form>
        <p>
          ביומן הזה מתועדות {profile.count} צלילות שבוצעו בפועל
          {profile.last ? `; האחרונה ב־${dateLabel(profile.last)}` : ""}. זה
          אינו אימות של מספר הצלילות הכולל שלך. יש להשלים את היומן ולהיערך
          לצלילות הכנה בישראל.
        </p>
      </section>
      {records.bookings
        .filter((b) => isActive(b) && b.marine)
        .map((activity) => (
          <article className="panel trip-marine-card" key={activity.id}>
            <div className="section-title">
              <h3>{activity.title}</h3>
              <span className="badge">
                {bookingStatusLabels[activity.status] ||
                  "סטטוס ישן — ניתן לעריכה"}
              </span>
            </div>
            <p>
              {num(activity, "plannedDays")
                ? `${num(activity, "plannedDays")} ימים מתוכננים`
                : "מספר ימים פתוח"}{" "}
              ·{" "}
              {num(activity, "plannedDives")
                ? `${num(activity, "plannedDives")} צלילות כיעד תכנוני`
                : "מספר צלילות טרם נקבע"}
            </p>
            <p>
              תקציב:{" "}
              {activity.amount
                ? `${str(activity, "amount")} ${str(activity, "currency")} לפי הרשומה`
                : activity.budgetMax
                  ? `תקרת העדפה ${str(activity, "budgetMax")} ${str(activity, "currency")} — לא מחיר מאומת`
                  : "טרם התקבלה הצעת מחיר"}
            </p>
            <p>
              מפעילים מועמדים:{" "}
              {str(activity, "candidateOperators") ||
                "טרם נבחרו; יש לקבל רישיון, המלצות ותנאים"}
            </p>
            <p>
              הכשרה וניסיון:{" "}
              {str(activity, "experienceRequirement") || "יש לאמת מול המפעיל"}
            </p>
            <p>
              תלות במזג אוויר:{" "}
              {activity.weatherDependent
                ? "כן — נדרש אישור יציאה לפי הים"
                : "יש לברר"}{" "}
              · ביטול: {str(activity, "cancellation") || "תנאים חסרים"}
            </p>
            <p>
              מקווים לפגוש: {str(activity, "wildlife") || "לפי תנאי השטח"}. אין
              הבטחת מפגש.
            </p>
            <p>{activity.notes}</p>
            <button
              className="secondary"
              onClick={() => onOpen("bookings", activity)}
            >
              <Pencil size={16} />
              עריכת הפעילות וההזמנה
            </button>
          </article>
        ))}
      <div className="panel">
        <h3>צלילה לפני טיסה — בדיקה נדרשת</h3>
        <p>
          סף ברירת המחדל לחישוב הוא 24 שעות לצורכי תכנון בלבד. יש להזין שעות
          ואזורי זמן, לבדוק את כל הטיסות ולקבל הנחיות לפי פרופיל הצלילות. תוצאה
          מחושבת אינה אישור לצלול או לטוס.
        </p>
        {checks.map((check) => (
          <p className="trip-caution" key={check.id}>
            {check.message}
          </p>
        ))}
      </div>
    </section>
  );
}

export function TripDashboard({
  state,
  onOpen,
  onNavigate,
}: Pick<Props, "state" | "onOpen"> & {
  onNavigate: (tab: "bookings" | "segments" | "expenses" | "transport") => void;
}) {
  const records = state.records[state.activeId],
    expedition = state.expeditions.find((e) => e.id === state.activeId)!;
  if (expedition.planVersion !== PLAN_VERSION) return null;
  const days = tripCalendar(records, expedition),
    budget = totals(records, expedition),
    tasks = urgentTasks(records, new Date().toISOString().slice(0, 10)).slice(
      0,
      3,
    );
  const critical = records.transport.filter(
    (t) =>
      isActive(t) &&
      t.critical &&
      !isExistingBooking(t) &&
      !records.bookings.some(
        (b) => b.id === t.bookingId && isExistingBooking(b),
      ),
  );
  const tentative = records.bookings.filter(
    (b) => isActive(b) && b.status === "Tentative booking",
  );
  return (
    <section className="panel trip-now" dir="rtl">
      <div className="section-title">
        <h2>מה צריך לסגור עכשיו?</h2>
        <button onClick={() => onNavigate("bookings")}>
          למרכז ההזמנות
          <ArrowLeft size={16} />
        </button>
      </div>
      <ol className="trip-priority-list">
        {tasks.map((task) => (
          <li key={task.id}>
            <button
              className="record-title"
              onClick={() => onOpen("tasks", task)}
            >
              {task.title}
            </button>
            <small>
              {task.date
                ? `יעד מומלץ: ${dateLabel(str(task, "date"))}`
                : "לפי הצורך"}
            </small>
          </li>
        ))}
      </ol>
      <div className="trip-now-summary">
        <button onClick={() => onNavigate("transport")}>
          {critical.length} טיסות קריטיות ללא אישור מקושר
        </button>
        <button onClick={() => onNavigate("segments")}>
          {days.filter((d) => d.missingLodging).length} לילות ללא אישור לינה
          מתוארך
        </button>
        <button onClick={() => onNavigate("segments")}>
          {days.filter((d) => d.locked).length} ימים נעולים ·{" "}
          {days.filter((d) => !d.locked).length} גמישים
        </button>
        <button onClick={() => onNavigate("expenses")}>
          תחזית {money(budget.estimated)} · שולם להזמנות {money(budget.paid)}
        </button>
      </div>
      {!!budget.unknownCosts && (
        <p className="trip-caution">
          ל־{budget.unknownCosts} פריטים חסר סכום. התחזית חלקית ואינה מעידה שכל
          יתרת התקציב פנויה.
        </p>
      )}
      {tentative.length > 0 && (
        <details>
          <summary>
            {tentative.length} הזמנות טנטטיביות או מדווחות דורשות החלטה / השלמת
            אישור
          </summary>
          {tentative.map((b) => (
            <button
              className="secondary"
              key={b.id}
              onClick={() => onOpen("bookings", b)}
            >
              {b.title}
            </button>
          ))}
        </details>
      )}
      {cancellationAlerts(records.bookings).length > 0 && (
        <button className="trip-caution" onClick={() => onNavigate("bookings")}>
          {cancellationAlerts(records.bookings).length} הזמנות מתקרבות לסיום
          הביטול החינמי — לבדיקה במרכז ההזמנות
        </button>
      )}
    </section>
  );
}

export function BudgetPlanning({
  state,
  onSave,
}: Pick<Props, "state" | "onSave">) {
  const [busy, setBusy] = useState(false);
  const expedition = state.expeditions.find((e) => e.id === state.activeId)!,
    records = state.records[state.activeId],
    budget = totals(records, expedition);
  const categories = [
    "טיסות",
    "לינה",
    "תחבורה",
    "צלילות",
    "ספארים",
    "ציוד",
    "אוכל",
    "ביטוח",
  ];
  return (
    <section className="panel trip-budget" dir="rtl">
      <h3>
        תקציב המסע · יעד כולל {money(expedition.budgetMin ?? 20000)}–
        {money(expedition.budgetMax ?? 25000)}
      </h3>
      <dl className="trip-budget-lines">
        <div>
          <dt>הוצאה בפועל — תשלומי הזמנות והוצאות נוספות</dt>
          <dd>{money(budget.paid + budget.actual)}</dd>
        </div>
        <div>
          <dt>יתרה לתשלום על הזמנות קיימות</dt>
          <dd>{money(budget.outstanding)}</dd>
        </div>
        <div>
          <dt>הזמנות עם ביטול חינם לפי המדיניות השמורה</dt>
          <dd>{money(budget.refundable)}</dd>
        </div>
        <div>
          <dt>התחייבויות שאינן ניתנות לביטול לפי המדיניות</dt>
          <dd>{money(budget.nonrefundable)}</dd>
        </div>
        <div>
          <dt>רזרבה מתוכננת</dt>
          <dd>{money(budget.reserve)}</dd>
        </div>
        <div>
          <dt>תחזית כולל רזרבה</dt>
          <dd>{money(budget.estimated + budget.reserve)}</dd>
        </div>
      </dl>
      <p>
        הקטגוריות עשויות לחפוף: תשלום הוא חלק מההזמנה ואינו הוצאה נוספת בתחזית.
        תקרת ספארי ותקציבי משנה הם יעדי תכנון, לא הצעות מחיר. חלופות בקבוצה אינן
        נסכמות לפני שנבחרת חלופה אחת.
      </p>
      {budget.unknownCosts > 0 && (
        <p className="trip-caution">
          חסרים מחירים ב־{budget.unknownCosts} פריטים. התחזית חלקית; מדיניות
          ביטול שאינה ידועה לא תוצג כהתחייבות שאינה ניתנת לביטול.
        </p>
      )}
      {budget.unselectedAlternatives > 0 && (
        <p className="trip-caution">
          {budget.unselectedAlternatives} קבוצות חלופות עדיין ללא בחירה. הן אינן
          כלולות בתחזית; יש לבחור חלופה כדי לכלול את עלותה.
        </p>
      )}
      <form
        className="form-grid"
        key={`${state.activeId}-${expedition.reserve}-${JSON.stringify(expedition.categoryBudgets)}`}
        onSubmit={async (e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          setBusy(true);
          try {
            await onSave({
              ...state,
              expeditions: state.expeditions.map((x) =>
                x.id === state.activeId
                  ? {
                      ...x,
                      budgetMin: Number(data.get("budgetMin")),
                      budgetMax: Number(data.get("budgetMax")),
                      reserve: Number(data.get("reserve") || 0),
                      categoryBudgets: Object.fromEntries(
                        categories.map((c) => [c, Number(data.get(c) || 0)]),
                      ),
                    }
                  : x,
              ),
            });
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          טווח יעד — גבול תחתון בש״ח
          <input
            type="number"
            name="budgetMin"
            min="0"
            step="any"
            defaultValue={expedition.budgetMin ?? 20000}
            required
          />
        </label>
        <label>
          טווח יעד — גבול עליון בש״ח
          <input
            type="number"
            name="budgetMax"
            min="1"
            step="any"
            defaultValue={expedition.budgetMax ?? 25000}
            required
          />
        </label>
        <label>
          רזרבה בש״ח
          <input
            type="number"
            name="reserve"
            min="0"
            step="any"
            defaultValue={expedition.reserve || ""}
          />
        </label>
        {categories.map((category) => (
          <label key={category}>
            יעד תקציב: {category}
            <input
              name={category}
              type="number"
              min="0"
              step="any"
              defaultValue={expedition.categoryBudgets?.[category] || ""}
            />
          </label>
        ))}
        <button className="secondary" disabled={busy}>
          שמירת רזרבה ותקציבי משנה
        </button>
      </form>
    </section>
  );
}

export function TripArchive({ state, onSave, onOpen }: Props) {
  const records = state.records[state.activeId];
  const [busy, setBusy] = useState(false);
  return (
    <section className="panel trip-archive" dir="rtl">
      <h2>
        <Archive size={22} />
        ארכיון התכנון
      </h2>
      <p>
        הרשומות המקוריות נשמרו עם סימון ארכיון. תשלומים, הוצאות והזמנות קיימות
        לא נמחקו. אפשר לפתוח כל רשומה או להחזיר אותה לתכנון.
      </p>
      {(Object.keys(records) as Kind[]).flatMap((kind) =>
        records[kind]
          .filter((r) => r.archived)
          .map((record) => (
            <article className="trip-task" key={`${kind}-${record.id}`}>
              <div className="trip-task-copy">
                <button
                  className="record-title"
                  onClick={() => onOpen(kind, record)}
                >
                  {record.title}
                </button>
                <p>{str(record, "archiveReason") || "נשמר מהתכנון הקודם"}</p>
              </div>
              <button
                className="secondary"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await onSave({
                      ...state,
                      records: {
                        ...state.records,
                        [state.activeId]: {
                          ...records,
                          [kind]: records[kind].map((r) =>
                            r.id === record.id ? { ...r, archived: false } : r,
                          ),
                        },
                      },
                    });
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                החזרה לתכנון
              </button>
            </article>
          )),
      )}
    </section>
  );
}
