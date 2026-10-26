"use client";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Compass, Mail, ArrowUpRight, Globe, ShieldCheck } from "lucide-react";
import { basePath, cloudConfigured, getSupabase } from "@/lib/supabase";
import Adventure from "./adventure";
export default function CloudWorkspace() {
  const [session, setSession] = useState<Session | null>(null),
    [ready, setReady] = useState(false),
    [lang, setLang] = useState<"he" | "en">("he"),
    [email, setEmail] = useState(""),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [sending, setSending] = useState(false);
  const t = (en: string, he: string) => (lang === "he" ? he : en);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "he" ? "rtl" : "ltr";
  }, [lang]);
  useEffect(() => {
    if (!cloudConfigured()) return;
    const client = getSupabase();
    let live = true;
    client.auth
      .getSession()
      .then(({ data, error }) => {
        if (!live) return;
        if (error) setError(error.message);
        setSession(data.session);
        setReady(true);
      })
      .catch((e) => {
        if (live) {
          setError(e.message);
          setReady(true);
        }
      });
    const { data } = client.auth.onAuthStateChange((_event, next) => {
      if (live) {
        setSession(next);
        setReady(true);
      }
    });
    return () => {
      live = false;
      data.subscription.unsubscribe();
    };
  }, []);
  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    setSending(true);
    setError("");
    setMessage("");
    try {
      const { error } = await getSupabase().auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: `${window.location.origin}${basePath}/` },
      });
      if (error) throw error;
      setMessage(
        t(
          "Check your email for a sign-in link. Open it in this browser.",
          "בדקו את תיבת הדוא״ל לקבלת קישור כניסה. פתחו אותו בדפדפן הזה.",
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed");
    } finally {
      setSending(false);
    }
  }
  if (session)
    return (
      <Adventure
        key={session.user.id}
        accountEmail={session.user.email}
        onSignOut={async () => {
          const { error } = await getSupabase().auth.signOut();
          if (error) setError(error.message);
        }}
      />
    );
  return (
    <div className="auth-page">
      <button
        className="auth-language"
        onClick={() => setLang(lang === "he" ? "en" : "he")}
      >
        <Globe size={16} />
        {lang === "he" ? "English" : "עברית"}
      </button>
      <section className="auth-journal">
        <div className="auth-brand">
          <Compass size={28} />
          ADVENTURE OS
        </div>
        <span className="eyebrow">
          {t("YOUR NEXT CHAPTER", "הפרק הבא שלך")}
        </span>
        <h1>
          {t(
            "Adventure starts with a little intention.",
            "ההרפתקה מתחילה בכוונה קטנה.",
          )}
        </h1>
        <p>
          {t(
            "Plan the logistics. Preserve the adventure.",
            "לתכנן את הלוגיסטיקה. לשמור על ההרפתקה.",
          )}
        </p>
        <div className="auth-landscape" />
      </section>
      <section className="auth-form">
        <ShieldCheck size={31} />
        <h2>{t("Your expeditions. Your space.", "המסעות שלך. המקום שלך.")}</h2>
        <p>
          {t(
            "Sign in with a secure email link. Your plans stay private and sync across your devices.",
            "כניסה עם קישור מאובטח לדוא״ל. התוכניות נשארות פרטיות ומסתנכרנות בין המכשירים שלך.",
          )}
        </p>
        {!cloudConfigured() ? (
          <div className="alert">
            {t(
              "The owner needs to configure Supabase before sign-in is available. See the deployment guide in the repository.",
              "בעל האתר צריך להגדיר את Supabase לפני שהכניסה תהיה זמינה. הוראות הפריסה נמצאות במאגר.",
            )}
          </div>
        ) : !ready ? (
          <p role="status">
            {t("Checking your session…", "בודקים את החיבור שלך…")}
          </p>
        ) : (
          <form onSubmit={signIn}>
            <label>
              {t("Email address", "כתובת דוא״ל")}
              <span>
                <Mail size={18} />
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  dir="ltr"
                />
              </span>
            </label>
            <button className="primary" disabled={sending}>
              {sending
                ? t("Sending…", "שולחים…")
                : t("Send a sign-in link", "שליחת קישור כניסה")}
              <ArrowUpRight size={16} />
            </button>
          </form>
        )}
        {message && (
          <p className="info" role="status">
            {message}
          </p>
        )}
        {error && (
          <p className="alert" role="alert">
            {error}
          </p>
        )}
        <small>
          {t(
            "No travel records are published with the website.",
            "רשומות הטיול אינן מתפרסמות כחלק מהאתר.",
          )}
        </small>
      </section>
    </div>
  );
}
