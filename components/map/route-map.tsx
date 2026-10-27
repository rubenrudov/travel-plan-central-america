"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  MapPinned,
  Search,
  LocateFixed,
  Plane,
  Ship,
  Car,
  RefreshCw,
} from "lucide-react";
import { State } from "@/lib/model";
import { MapTarget, Point, mapPlan, targetFields } from "@/lib/map-planning";
import {
  GeoMatch,
  RoadRoute,
  searchLocation,
  drivingRoute,
} from "@/lib/map-services";
const MapCanvas = dynamic(() => import("./map-canvas"), {
  ssr: false,
  loading: () => <div className="map-loading">Loading OpenStreetMap…</div>,
});
export default function RouteMap({
  state,
  lang,
  onSave,
  onOpen,
}: {
  state: State;
  lang: "he" | "en";
  onSave: (state: State) => Promise<boolean>;
  onOpen: (target: MapTarget) => void;
}) {
  const t = (en: string, he: string) => (lang === "he" ? he : en);
  const records = state.records[state.activeId];
  const plan = mapPlan(records);
  const [selected, setSelected] = useState<string>(""),
    [searching, setSearching] = useState(false),
    [matches, setMatches] = useState<GeoMatch[]>([]),
    [error, setError] = useState(""),
    [picking, setPicking] = useState(false),
    [saving, setSaving] = useState(false),
    [roads, setRoads] = useState<Record<string, RoadRoute | null>>({}),
    [roadLoading, setRoadLoading] = useState(false),
    [resolvedRoadKey, setResolvedRoadKey] = useState(""),
    [routeRetry, setRouteRetry] = useState(0);
  const roadKey = JSON.stringify(
    plan.legs
      .filter((l) => l.mode === "car")
      .map((l) => ({ id: l.id, from: l.from, to: l.to })),
  );
  useEffect(() => {
    const legs = JSON.parse(roadKey) as {
      id: string;
      from: Point;
      to: Point;
    }[];
    const controller = new AbortController();
    let live = true;
    async function load() {
      setRoadLoading(true);
      const routes: Record<string, RoadRoute | null> = {};
      for (const leg of legs) {
        if (controller.signal.aborted) return;
        try {
          routes[leg.id] = await drivingRoute(
            leg.from,
            leg.to,
            controller.signal,
          );
        } catch {
          if (controller.signal.aborted) return;
          routes[leg.id] = null;
        }
        if (live) {
          setRoads({ ...routes });
          setResolvedRoadKey(roadKey);
        }
        await new Promise((r) => setTimeout(r, 1100));
      }
      if (live) {
        setRoads(routes);
        setResolvedRoadKey(roadKey);
        setRoadLoading(false);
      }
    }
    void load();
    return () => {
      live = false;
      controller.abort();
    };
  }, [roadKey, routeRetry]);
  const target = plan.targets.find((item) => item.key === selected);
  const placed = plan.targets.filter((item) => item.point);
  const missing = plan.targets.filter((item) => !item.point);
  const effectiveRoads = resolvedRoadKey === roadKey ? roads : {};
  const roadFailures = plan.legs.filter(
    (l) => l.mode === "car" && effectiveRoads[l.id] === null,
  );
  const currentRoads = Object.fromEntries(
    plan.legs
      .filter((l) => l.mode === "car")
      .flatMap((l) =>
        l.id in effectiveRoads ? [[l.id, effectiveRoads[l.id]]] : [],
      ),
  );
  async function find(item: MapTarget) {
    setSelected(item.key);
    setPicking(false);
    setSearching(true);
    setMatches([]);
    setError("");
    try {
      const found = await searchLocation(item.query);
      setMatches(found);
      if (!found.length)
        setError(
          t(
            "No matches. Place the pin manually or edit the saved address.",
            "לא נמצאו התאמות. הציבו סיכה ידנית או ערכו את הכתובת השמורה.",
          ),
        );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Location lookup failed");
    } finally {
      setSearching(false);
    }
  }
  async function savePoint(point: Point, label: string, source: string) {
    if (!target || saving) return;
    setSaving(true);
    setError("");
    const fields = targetFields(target.side);
    const updated = records[target.kind].map((row) =>
      row.id === target.id
        ? {
            ...row,
            [fields.lat]: point[0],
            [fields.lng]: point[1],
            [fields.query]: target.query,
            [fields.label]: label,
            [fields.source]: source,
          }
        : row,
    );
    try {
      const saved = await onSave({
        ...state,
        records: {
          ...state.records,
          [state.activeId]: { ...records, [target.kind]: updated },
        },
      });
      if (saved) {
        setMatches([]);
        setSelected("");
        setPicking(false);
      } else
        setError(
          t(
            "Pin was not saved. Resolve the save error before trying again.",
            "הסיכה לא נשמרה. יש לפתור את שגיאת השמירה לפני ניסיון נוסף.",
          ),
        );
    } finally {
      setSaving(false);
    }
  }
  return (
    <section className="route-map-section">
      <div className="section-title">
        <div>
          <h2>
            <MapPinned size={18} />{" "}
            {t("Your expedition, on the map", "המסע שלך על המפה")}
          </h2>
          <p className="section-subtitle">
            {t(
              "Destinations, connections, and the places you’ll call home.",
              "היעדים, המעברים והמקומות שיהיו הבית שלך בדרך.",
            )}
          </p>
        </div>
        <span className="badge">OpenStreetMap</span>
      </div>
      <div className="map-legend">
        <span>
          <MapPinned size={14} />
          {placed.filter((x) => x.kind === "destinations").length}{" "}
          {t("destinations", "יעדים")}
        </span>
        <span>
          ⌂ {placed.filter((x) => x.kind === "bookings").length}{" "}
          {t("stays", "מקומות לינה")}
        </span>
        <span>
          <Plane size={14} />
          {t("Flight · dotted curve", "טיסה · קו עקום מנוקד")}
        </span>
        <span>
          <Ship size={14} />
          {t("Ferry · dotted curve", "מעבורת · קו עקום מנוקד")}
        </span>
        <span>
          <Car size={14} />
          {t("Estimated road route", "מסלול כביש משוער")}
        </span>
      </div>
      <MapCanvas
        key={state.activeId}
        targets={plan.targets}
        legs={plan.legs}
        roads={currentRoads}
        lang={lang}
        picking={picking && !saving}
        onPick={(point) =>
          void savePoint(
            point,
            t("Manually placed pin", "סיכה שהוצבה ידנית"),
            "Manual map pin",
          )
        }
        onOpen={onOpen}
      />
      <div className="map-service-note">
        {t(
          "Hover or tap a stay marker for saved hotel/hostel details. Flight/ferry curves are schematic. Road routes use OSRM estimates, not live schedules or navigation.",
          "עברו עם העכבר או הקישו על סיכת לינה לפרטי המלון או ההוסטל השמורים. טיסות ומעבורות מוצגות באופן סכמטי. מסלולי כביש הם אומדני OSRM, לא מידע חי או הוראות ניווט.",
        )}
      </div>
      {roadLoading && (
        <p className="muted" role="status">
          {t("Finding road routes…", "מחפשים מסלולי כביש…")}
        </p>
      )}
      {roadFailures.length > 0 && (
        <div className="info">
          {t("Road routing unavailable for", "ניתוב כביש אינו זמין עבור")}:{" "}
          {roadFailures.map((x) => x.title).join(" · ")}.{" "}
          {t(
            "Dotted straight lines are planning connections only.",
            "קווים ישרים מנוקדים הם חיבורים תכנוניים בלבד.",
          )}{" "}
          <button onClick={() => setRouteRetry((x) => x + 1)}>
            <RefreshCw size={14} />
            {t("Retry", "ניסיון נוסף")}
          </button>
        </div>
      )}
      {plan.unresolved.length > 0 && (
        <details className="map-unresolved">
          <summary>
            {plan.unresolved.length}{" "}
            {t(
              "connections need locations or links",
              "מעברים דורשים מיקומים או קישור ליעדים",
            )}
          </summary>
          {plan.unresolved.map((name) => (
            <p key={name}>{name}</p>
          ))}
        </details>
      )}
      <details
        className="map-location-tools"
        open={placed.length === 0 || !!target || undefined}
      >
        <summary>
          {t("Map locations", "מיקומים במפה")} · {missing.length}{" "}
          {t("unplaced", "ללא סיכה")}
        </summary>
        <p className="muted">
          {t(
            "Search sends the selected name/address to OpenStreetMap Nominatim. Choose a match to save its coordinates privately with your expedition, or place a pin on the map. Results are approximate; verify the property entrance.",
            "החיפוש שולח את השם או הכתובת שנבחרו ל־Nominatim של OpenStreetMap. בחרו התאמה לשמירת הקואורדינטות במסע הפרטי שלכם, או הציבו סיכה במפה. התוצאות משוערות; יש לבדוק את כניסת הנכס.",
          )}
        </p>
        <div className="map-location-list">
          {plan.targets.map((item) => (
            <div className="map-location-row" key={item.key}>
              <div>
                <strong>
                  {item.kind === "bookings" ? "⌂ " : ""}
                  {item.title}
                </strong>
                <small>{item.query}</small>
                {item.point && (
                  <small dir="ltr">
                    {item.point[0].toFixed(5)}, {item.point[1].toFixed(5)}
                  </small>
                )}
              </div>
              <span className="badge">
                {item.point
                  ? t("Located", "ממוקם")
                  : t("Needs a pin", "נדרשת סיכה")}
              </span>
              <button
                disabled={searching || saving}
                onClick={() => void find(item)}
              >
                <Search size={14} />
                {t("Search", "חיפוש")}
              </button>
              <button
                disabled={searching || saving}
                onClick={() => {
                  setSelected(item.key);
                  setMatches([]);
                  setPicking(true);
                  setError("");
                }}
              >
                <LocateFixed size={14} />
                {t("Place pin", "הצבת סיכה")}
              </button>
            </div>
          ))}
        </div>
      </details>
      {target && (
        <div className="map-location-review">
          <strong>{target.title}</strong>
          {picking ? (
            <p role="status">
              {saving
                ? t("Saving location…", "שומרים מיקום…")
                : t(
                    "Click the map to save this pin. Dragging only pans the map.",
                    "הקישו על המפה לשמירת הסיכה. גרירה מזיזה את המפה בלבד.",
                  )}
            </p>
          ) : searching ? (
            <p role="status">
              {t("Searching for this location…", "מחפשים את המיקום…")}
            </p>
          ) : (
            <>
              <p className="muted">
                {t(
                  "Choose the matching location; nothing is saved automatically.",
                  "בחרו את המיקום המתאים; דבר לא נשמר אוטומטית.",
                )}
              </p>
              {matches.map((match, i) => (
                <button
                  className="map-match"
                  disabled={saving}
                  key={i}
                  onClick={() =>
                    void savePoint(
                      match.point,
                      match.label,
                      "OpenStreetMap / Nominatim",
                    )
                  }
                >
                  <span>{match.label}</span>
                  <small dir="ltr">
                    {match.point.map((n) => n.toFixed(5)).join(", ")}
                  </small>
                </button>
              ))}
            </>
          )}
          <button
            className="secondary"
            disabled={saving}
            onClick={() => {
              setSelected("");
              setMatches([]);
              setPicking(false);
            }}
          >
            {t("Cancel", "ביטול")}
          </button>
        </div>
      )}
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
