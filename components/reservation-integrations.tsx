"use client";
import { useEffect, useState } from "react";
import {
  Mail,
  RefreshCw,
  ExternalLink,
  Link2,
  Check,
  AlertTriangle,
} from "lucide-react";
import { cloudMode, getSupabase } from "@/lib/supabase";
import { State, Entry } from "@/lib/model";
import { matchDestination, cancellationAlerts } from "@/lib/reservations";
type Candidate = {
  id: string;
  provider: string;
  source_url: string;
  candidate: Entry;
  status: string;
};
export default function ReservationIntegrations({
  state,
  onRefresh,
  lang,
}: {
  state: State;
  onRefresh: () => void;
  lang: "he" | "en";
}) {
  const t = (en: string, he: string) => (lang === "he" ? he : en);
  const [status, setStatus] = useState<{
      connected: boolean;
      email?: string;
      last_sync?: string;
      last_error?: string;
    } | null>(null),
    [items, setItems] = useState<Candidate[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [selection, setSelection] = useState<Record<string, string>>({});
  async function action(action: string, extra: Record<string, unknown> = {}) {
    const { data, error } = await getSupabase().functions.invoke(
      "gmail-connect",
      { body: { action, ...extra } },
    );
    if (error)
      throw Error(
        "Gmail integration is unavailable or needs setup. See docs/RESERVATIONS.md.",
      );
    if (data.error) throw Error(data.error);
    return data;
  }
  async function refresh() {
    if (!cloudMode) return;
    try {
      setError("");
      setStatus(await action("status"));
      const { data, error } = await getSupabase()
        .from("reservation_inbox")
        .select("id,provider,source_url,candidate,status")
        .eq("status", "review")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setItems(data || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load integration");
    }
  }
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("gmail"))
      void refresh(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function run(callback: () => Promise<void>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await callback();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }
  const records = state.records[state.activeId];
  return (
    <>
      <section className="panel">
        <h2>
          {t(
            "In-app cancellation notifications",
            "התראות ביטול בתוך האפליקציה",
          )}
        </h2>
        <p>
          {t(
            "No Google account or token is needed. Add a booking, its accommodation address, and its exact free-cancellation cutoff. Verify the timezone to receive alerts in Overview starting one week before the deadline.",
            "אין צורך בחשבון Google או בטוקן. הוסיפו הזמנה, כתובת לינה ומועד מדויק לסיום הביטול החינמי. אמתו את אזור הזמן כדי לקבל התראות במבט על החל משבוע לפני המועד.",
          )}
        </p>
        <p className="muted">
          {t(
            "In-app alerts appear while you use the app; they do not send a message or push notification when it is closed.",
            "התראות בתוך האפליקציה מוצגות בזמן השימוש; הן אינן שולחות הודעה או התראת פוש כשהיא סגורה.",
          )}
        </p>
      </section>
      <details
        className="optional-gmail"
        onToggle={(e) => {
          if (e.currentTarget.open) void refresh();
        }}
      >
        <summary>
          {t(
            "Optional: connect Google / Gmail for reservation imports",
            "אופציונלי: חיבור Google / Gmail לייבוא הזמנות",
          )}
        </summary>
        <section className="panel">
          <div className="section-title">
            <h2>
              <Mail size={18} /> {t("Reservation inbox", "תיבת הזמנות")}
            </h2>
            <span className="badge">Booking.com · Hostelworld</span>
          </div>
          <p className="muted">
            {t(
              "Connect the Gmail account that receives confirmations. Only provider messages are processed. Missing or ambiguous details stay here for review.",
              "חברו את חשבון Gmail שמקבל אישורי הזמנות. רק הודעות מהספקים מעובדות. פרטים חסרים או לא ברורים ממתינים כאן לבדיקה.",
            )}
          </p>
          {!cloudMode ? (
            <div className="info">
              {t(
                "Background Gmail sync requires the authenticated cloud edition. Booking fields and in-app reminders work locally.",
                "סנכרון Gmail ברקע דורש את גרסת הענן המאומתת. פרטי הזמנות והתראות בתוך האפליקציה זמינים גם מקומית.",
              )}
            </div>
          ) : (
            <>
              <div className="tabs">
                {status?.connected ? (
                  <>
                    <span className="badge green">{status.email}</span>
                    <button
                      disabled={busy}
                      onClick={() =>
                        run(async () => {
                          await action("sync");
                          await refresh();
                          onRefresh();
                          setMessage(
                            t(
                              "This batch has been checked. More mail is processed by the background schedule.",
                              "המנה הזו נבדקה. הודעות נוספות יעובדו בסריקה המתוזמנת.",
                            ),
                          );
                        })
                      }
                    >
                      <RefreshCw size={14} />
                      {t("Sync now", "סנכרון עכשיו")}
                    </button>
                    <button
                      disabled={busy}
                      onClick={() =>
                        run(async () => {
                          const result = await action("disconnect");
                          await refresh();
                          if (!result.revoked)
                            setMessage(
                              t(
                                "Local access removed. Revoke the Google app permission in your Google account as well.",
                                "הגישה המקומית הוסרה. יש להסיר גם את הרשאת האפליקציה בחשבון Google.",
                              ),
                            );
                        })
                      }
                    >
                      {t("Disconnect Gmail", "ניתוק Gmail")}
                    </button>
                  </>
                ) : (
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        const result = await action("connect");
                        window.location.assign(result.url);
                      })
                    }
                  >
                    <Link2 size={15} />
                    {t("Connect Gmail", "חיבור Gmail")}
                  </button>
                )}
                <button disabled={busy} onClick={() => run(refresh)}>
                  {t("Refresh status", "רענון מצב")}
                </button>
              </div>
              {status?.last_sync && (
                <p className="muted">
                  {t("Last completed scan", "סריקה מלאה אחרונה")}:{" "}
                  {status.last_sync}
                </p>
              )}
              {status?.last_error && (
                <p className="alert">{status.last_error}</p>
              )}
              <p className="muted">
                {t(
                  "Google is optional. In-app alerts work without it. If you later enable email reminders, they require the server schedule and read/send Gmail consent.",
                  "Google הוא אופציונלי. התראות בתוך האפליקציה פועלות בלעדיו. תזכורות דוא״ל עתידיות דורשות תזמון בשרת והרשאות קריאה ושליחה ב־Gmail.",
                )}
              </p>
            </>
          )}
          {error && (
            <div className="alert" role="alert">
              <AlertTriangle size={16} />
              {error}
            </div>
          )}
          {message && (
            <p className="info" role="status">
              {message}
            </p>
          )}
        </section>
        <div className="section-title" style={{ margin: "25px 0 15px" }}>
          <h2>{t("Needs your review", "ממתין לבדיקה שלך")}</h2>
          <span className="badge">{items.length}</span>
        </div>
        {items.map((item) => {
          const candidate = item.candidate;
          const destination =
            selection[item.id] ??
            matchDestination(
              String(candidate.stayAddress || ""),
              records.destinations,
            ) ??
            "";
          return (
            <article
              className="panel"
              key={item.id}
              style={{ marginBottom: 15 }}
            >
              <h3>
                {candidate.title ||
                  t("Reservation details needed", "נדרשים פרטי הזמנה")}
              </h3>
              <p className="muted">
                {item.provider} · {String(candidate.date || "—")} —{" "}
                {String(candidate.end || "—")}
              </p>
              <p>{String(candidate.stayAddress || "")}</p>
              <div className="info">
                {t(
                  "Import the available details, then verify the cancellation policy and exact local deadline in the booking editor. Email reminders stay off until you verify them.",
                  "ייבאו את הפרטים הזמינים, ואז בדקו את תנאי הביטול והמועד המקומי המדויק בעורך ההזמנה. תזכורות דוא״ל נשארות כבויות עד לאימות.",
                )}
              </div>
              <label>
                {t("Destination", "יעד")}{" "}
                <select
                  value={destination}
                  onChange={(e) =>
                    setSelection({ ...selection, [item.id]: e.target.value })
                  }
                >
                  <option value="">
                    {t("Choose manually", "בחירה ידנית")}
                  </option>
                  {records.destinations.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title}
                    </option>
                  ))}
                </select>
              </label>
              <div className="tabs">
                <a target="_blank" rel="noreferrer" href={item.source_url}>
                  <ExternalLink size={14} />
                  {t("Open original email", "פתיחת ההודעה המקורית")}
                </a>
                <button
                  disabled={busy || !destination}
                  onClick={() =>
                    run(async () => {
                      await action("apply", {
                        id: item.id,
                        expeditionId: state.activeId,
                        destinationId: destination,
                      });
                      await refresh();
                      onRefresh();
                    })
                  }
                >
                  <Check size={14} />
                  {t("Import into this expedition", "ייבוא למסע הזה")}
                </button>
                <button
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await action("ignore", { id: item.id });
                      await refresh();
                    })
                  }
                >
                  {t("Ignore", "התעלמות")}
                </button>
              </div>
            </article>
          );
        })}
        {items.length === 0 && (
          <div className="empty">
            <Mail size={30} />
            <p>
              {t(
                "No reservations waiting for review.",
                "אין הזמנות הממתינות לבדיקה.",
              )}
            </p>
          </div>
        )}
      </details>
      <section className="panel" style={{ marginTop: 20 }}>
        <h2>{t("Free-cancellation watch", "מעקב ביטול חינם")}</h2>
        {cancellationAlerts(records.bookings).map(({ booking }) => (
          <p key={booking.id}>
            {booking.title} · {String(booking.freeCancellationAt)} ·{" "}
            {String(booking.cancellationTimezone)}
          </p>
        ))}
        <p className="muted">
          {t(
            "Only booked stays with a verified free-cancellation deadline generate reminders. Non-refundable and unknown policies do not. A week means the same local time seven calendar days before the deadline.",
            "רק שהיות שהוזמנו ומועד הביטול החינמי שלהן אומת יוצרות תזכורות. תנאים לא ידועים או ללא החזר אינם יוצרים תזכורת. שבוע הוא אותה שעה מקומית שבעה ימים לפני המועד.",
          )}
        </p>
      </section>
    </>
  );
}
