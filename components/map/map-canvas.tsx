"use client";
import { Fragment, useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
  useMapEvents,
  Tooltip,
} from "react-leaflet";
import { divIcon, latLngBounds } from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  MapLeg,
  MapTarget,
  Point,
  connectionArc,
  bearing,
} from "@/lib/map-planning";
import { RoadRoute } from "@/lib/map-services";
import { str } from "@/lib/model";
function Fit({ points }: { points: Point[] }) {
  const map = useMap();
  const signature = JSON.stringify(points);
  useEffect(() => {
    const current = JSON.parse(signature) as Point[];
    const fit = () => {
      if (current.length)
        map.fitBounds(latLngBounds(current), {
          padding: [40, 40],
          maxZoom: 12,
        });
    };
    fit();
    map.on("resize", fit);
    return () => {
      map.off("resize", fit);
    };
  }, [map, signature]);
  return null;
}
function Picker({
  enabled,
  onPick,
}: {
  enabled: boolean;
  onPick: (point: Point) => void;
}) {
  useMapEvents({
    click: (event) => {
      if (enabled) onPick([event.latlng.lat, event.latlng.lng]);
    },
  });
  return null;
}
const plane = '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>';
const ship =
  '<path d="M12 22c4-1 7-4 9-8l-9-4-9 4c2 4 5 7 9 8Z"/><path d="M7 12V5h10v7M12 5V2M4 22l2-1 3 1 3-1 3 1 3-1 2 1"/>';
function pin(kind: string, index: number) {
  return divIcon({
    className: "adventure-pin",
    html: `<span class="${kind === "bookings" ? "stay-pin" : "destination-pin"}">${kind === "bookings" ? "⌂" : index + 1}</span>`,
    iconSize: [32, 38],
    iconAnchor: [16, 36],
    popupAnchor: [0, -32],
  });
}
export default function MapCanvas({
  targets,
  legs,
  roads,
  lang,
  picking,
  onPick,
  onOpen,
}: {
  targets: MapTarget[];
  legs: MapLeg[];
  roads: Record<string, RoadRoute | null>;
  lang: "he" | "en";
  picking: boolean;
  onPick: (point: Point) => void;
  onOpen: (target: MapTarget) => void;
}) {
  const [tileError, setTileError] = useState(false),
    [retry, setRetry] = useState(0);
  const t = (en: string, he: string) => (lang === "he" ? he : en);
  const markers = targets.filter((x) => x.point);
  const points = [
    ...markers.map((t) => t.point!),
    ...legs.flatMap((l) => [l.from, l.to]),
  ];
  return (
    <div className={"route-map-canvas " + (picking ? "is-picking" : "")}>
      <MapContainer
        center={[20, -93]}
        zoom={4}
        scrollWheelZoom={false}
        className="leaflet-expedition"
        aria-label={t("Expedition route map", "מפת מסלול המסע")}
      >
        <TileLayer
          key={retry}
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          maxZoom={19}
          eventHandlers={{ tileerror: () => setTileError(true) }}
        />
        <Fit points={points} />
        <Picker enabled={picking} onPick={onPick} />
        {legs.map((leg) => {
          const curved = leg.mode === "flight" || leg.mode === "ferry";
          const road = roads[leg.id];
          const positions = curved
            ? connectionArc(leg.from, leg.to)
            : road?.points || [leg.from, leg.to];
          const middle = Math.floor(positions.length / 2);
          const color =
            leg.mode === "flight"
              ? "#8d755b"
              : leg.mode === "ferry"
                ? "#42898e"
                : leg.mode === "car" && road
                  ? "#426c50"
                  : "#9a9d90";
          const description = curved
            ? t(
                "Schematic connection — not a navigation route",
                "חיבור סכמטי — אינו נתיב ניווט",
              )
            : road
              ? `${t("Estimated road route", "מסלול כביש משוער")} · ${(road.distance / 1000).toFixed(1)} km · ${Math.round(road.duration / 60)} min`
              : t(
                  "Straight planning connection — road route not available",
                  "חיבור תכנוני ישר — מסלול כביש אינו זמין",
                );
          return (
            <Fragment key={leg.id}>
              <Polyline
                positions={positions}
                pathOptions={{
                  color,
                  weight: road ? 4 : 2.5,
                  dashArray: road ? undefined : "3 8",
                  opacity: 0.9,
                }}
              >
                <Tooltip>
                  {leg.title}
                  <br />
                  {description}
                </Tooltip>
              </Polyline>
              {curved && (
                <Marker
                  position={positions[middle]}
                  icon={divIcon({
                    className: "transport-map-icon",
                    html: `<span data-mode="${leg.mode}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" style="transform:rotate(${leg.mode === "flight" ? bearing(positions[middle - 1], positions[middle + 1]) - 45 : 0}deg)">${leg.mode === "flight" ? plane : ship}</svg></span>`,
                    iconSize: [32, 32],
                    iconAnchor: [16, 16],
                  })}
                  title={leg.title + " · " + leg.mode}
                >
                  <Tooltip>
                    {leg.title}
                    <br />
                    {description}
                  </Tooltip>
                </Marker>
              )}
            </Fragment>
          );
        })}
        {markers.map((target, index) => (
          <Marker
            key={target.key}
            position={target.point!}
            icon={pin(target.kind, index)}
            title={target.title}
            eventHandlers={{
              click: (event) => event.target.openPopup(),
              mouseover: (e) => {
                if (!picking) e.target.openPopup();
              },
            }}
          >
            <Popup
              maxWidth={250}
              minWidth={170}
              keepInView
              autoPanPadding={[18, 18]}
            >
              <div
                className="map-booking-popup"
                dir={lang === "he" ? "rtl" : "ltr"}
              >
                <small>
                  {target.kind === "bookings"
                    ? str(target.record, "bookingSource") ||
                      str(target.record, "provider") ||
                      t("Accommodation", "לינה")
                    : t("Destination / connection", "יעד / מעבר")}
                </small>
                <h3>{target.title}</h3>
                {target.kind === "bookings" ? (
                  <>
                    <p>{str(target.record, "stayAddress")}</p>
                    <p>
                      {str(target.record, "date") || "—"} →{" "}
                      {str(target.record, "end") || "—"}
                    </p>
                    <p>
                      {str(target.record, "status")}
                      {target.record.amount
                        ? " · " +
                          str(target.record, "amount") +
                          " " +
                          str(target.record, "currency")
                        : ""}
                    </p>
                    {target.record.freeCancellationAt && (
                      <p>
                        {t("Free cancellation ends", "ביטול חינם עד")}:{" "}
                        {str(target.record, "freeCancellationLocal")}{" "}
                        {str(target.record, "cancellationTimezone")}{" "}
                        {!target.record.cancellationVerified &&
                          t("(needs verification)", "(דורש אימות)")}
                      </p>
                    )}
                    {target.record.cancellation && (
                      <p>{str(target.record, "cancellation")}</p>
                    )}
                    {/^https?:\/\//.test(str(target.record, "source")) && (
                      <a
                        href={str(target.record, "source")}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {t("Saved provider link", "קישור שמור לספק")}
                      </a>
                    )}
                  </>
                ) : (
                  <p>{str(target.record, "country") || target.query}</p>
                )}
                <p className="muted">
                  {t(
                    "Saved details; no live provider data",
                    "פרטים שמורים; ללא מידע חי מהספק",
                  )}
                </p>
                <button onClick={() => onOpen(target)}>
                  {t("Open record", "פתיחת הרשומה")}
                </button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      {tileError && (
        <div className="map-tile-error" role="status">
          {t("Map tiles could not load.", "אריחי המפה לא נטענו.")}{" "}
          <button
            onClick={() => {
              setRetry((x) => x + 1);
              setTileError(false);
            }}
          >
            {t("Retry", "ניסיון נוסף")}
          </button>
        </div>
      )}
    </div>
  );
}
