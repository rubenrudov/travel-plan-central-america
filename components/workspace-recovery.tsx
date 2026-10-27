"use client";
import { useState } from "react";
import { Compass, Download, RefreshCw, ShieldCheck } from "lucide-react";
import {
  RecoveryPlan,
  downloadOriginalWorkspace,
} from "@/lib/workspace-recovery";
import { State } from "@/lib/model";
export default function WorkspaceRecovery({
  plan,
  onRestore,
  onSignOut,
  lang,
}: {
  plan: RecoveryPlan;
  onRestore: (next: State) => Promise<boolean>;
  onSignOut?: () => void;
  lang: "he" | "en";
}) {
  const [backedUp, setBackedUp] = useState(false),
    [busy, setBusy] = useState(false),
    [failed, setFailed] = useState(false);
  const t = (en: string, he: string) => (lang === "he" ? he : en);
  return (
    <main className="workspace-recovery">
      <section className="panel">
        <Compass size={36} />
        <h1>
          {t("Reconnect your expedition records", "חיבור מחדש של רשומות המסע")}
        </h1>
        <p>
          {t(
            "The saved expedition IDs do not match their record collections. Your bookings, expenses and other records have not been reset.",
            "מזהי המסעות השמורים אינם תואמים לאוספי הרשומות. ההזמנות, ההוצאות ושאר הנתונים לא אופסו.",
          )}
        </p>
        <details>
          <summary>{t("What needs attention", "מה דורש תיקון")}</summary>
          {plan.issues.map((issue, i) => (
            <p className="muted" dir="ltr" key={i}>
              {issue}
            </p>
          ))}
        </details>
        {plan.proposed ? (
          <>
            <h2>{t("Proposed repair", "התיקון המוצע")}</h2>
            <ul>
              {plan.changes.map((change, i) => (
                <li key={i}>{change}</li>
              ))}
            </ul>
            <p className="info">
              <ShieldCheck size={18} />
              {t(
                "Check the proposed link before confirming. Download the original backup first; the repair preserves record IDs and contents and uses the existing revision to prevent overwriting newer changes.",
                "בדקו את הקישור המוצע לפני אישור. הורידו קודם גיבוי מקורי; התיקון שומר על מזהי הרשומות ותוכנן ומונע דריסה של שינויים חדשים יותר.",
              )}
            </p>
          </>
        ) : (
          <>
            <h2>{t("Manual review is needed", "נדרשת בדיקה ידנית")}</h2>
            <p>{plan.reason}</p>
            <p>
              {t(
                "Download the original backup and share it for a targeted repair. It contains private travel data; keep it secure.",
                "הורידו את הגיבוי המקורי כדי לאפשר תיקון ממוקד. הוא מכיל מידע פרטי על הטיול; שמרו עליו באופן פרטי.",
              )}
            </p>
          </>
        )}
        <div className="settings-actions">
          <button
            className="secondary"
            disabled={busy}
            onClick={() => {
              downloadOriginalWorkspace(plan.original);
              setBackedUp(true);
            }}
          >
            <Download size={16} />
            {t("Download original backup", "הורדת הגיבוי המקורי")}
          </button>
          {plan.proposed && (
            <button
              className="primary"
              disabled={!backedUp || busy}
              onClick={async () => {
                setBusy(true);
                setFailed(false);
                const restored = await onRestore(plan.proposed!);
                if (!restored) setFailed(true);
                setBusy(false);
              }}
            >
              <ShieldCheck size={16} />
              {busy
                ? t("Repairing…", "מתקנים…")
                : t("Confirm repair", "אישור התיקון")}
            </button>
          )}
          <button
            className="secondary"
            disabled={busy}
            onClick={() => window.location.reload()}
          >
            <RefreshCw size={16} />
            {t("Reload latest data", "טעינת הנתונים העדכניים")}
          </button>
          {onSignOut && (
            <button className="secondary" disabled={busy} onClick={onSignOut}>
              {t("Sign out", "יציאה מהחשבון")}
            </button>
          )}
        </div>
        {failed && (
          <p className="alert" role="alert">
            {t(
              "The repair save could not be confirmed. Keep the original backup and reload to check the latest data before trying again.",
              "לא ניתן לאשר שהתיקון נשמר. שמרו את הגיבוי המקורי וטענו מחדש כדי לבדוק את הנתונים העדכניים לפני ניסיון נוסף.",
            )}
          </p>
        )}
        <small className="muted">
          {t(
            "No reset, reseeding, or removal of personal records.",
            "ללא איפוס, טעינה מחדש של נתוני דוגמה או מחיקת רשומות אישיות.",
          )}
        </small>
      </section>
    </main>
  );
}
