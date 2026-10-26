import { Entry, Expedition, Kind, State, cost, num, str } from "./model";
import { emptyRecords } from "./seed";
export function recalculatePayments(
  records: Record<Kind, Entry[]>,
  expedition: Expedition,
  ids: string[],
) {
  return {
    ...records,
    bookings: records.bookings.map((b) => {
      if (!ids.includes(b.id)) return b;
      const paid =
        records.expenses
          .filter((x) => x.bookingId === b.id && x.status !== "Cancelled")
          .reduce((s, x) => s + cost(x, expedition), 0) /
        (num(b, "rate") || expedition.rates[str(b, "currency")] || 1);
      return {
        ...b,
        paid,
        paymentStatus:
          paid === 0
            ? "Unpaid"
            : paid >= num(b, "amount")
              ? "Paid"
              : "Deposit paid",
      };
    }),
  };
}
// Equipment identity and ownership are shared; each expedition keeps its own packing state.
export function shareGear(
  state: State,
  activeId: string,
  item: Entry,
): State["records"] {
  return Object.fromEntries(
    Object.entries(state.records).map(([id, records]) => {
      if (id === activeId) return [id, records];
      const existing = records.gear.find((x) => x.id === item.id);
      const copy = {
        ...item,
        packing: existing?.packing || false,
        packed: existing?.packed || false,
        destinationId: existing?.destinationId || "",
      };
      return [
        id,
        {
          ...records,
          gear: existing
            ? records.gear.map((x) => (x.id === item.id ? copy : x))
            : [...records.gear, copy],
        },
      ];
    }),
  );
}
export function newExpeditionRecords(state: State) {
  const gear = new Map<string, Entry>();
  for (const records of Object.values(state.records))
    for (const g of records.gear)
      gear.set(g.id, {
        ...g,
        packed: false,
        packing: false,
        destinationId: "",
      });
  return { ...emptyRecords(), gear: [...gear.values()] };
}
