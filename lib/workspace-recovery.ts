import { State, stateSchema, workspaceEnvelopeSchema, kinds } from "./model";
export type RecoveryPlan = {
  original: unknown;
  proposed: State | null;
  changes: string[];
  issues: string[];
  reason?: string;
};
function preservesOriginal(original: unknown, parsed: unknown): boolean {
  if (Array.isArray(original))
    return (
      Array.isArray(parsed) &&
      original.length === parsed.length &&
      original.every((value, i) => preservesOriginal(value, parsed[i]))
    );
  if (original && typeof original === "object") {
    if (!parsed || typeof parsed !== "object") return false;
    return Object.entries(original).every(
      ([key, value]) =>
        Object.hasOwn(parsed, key) &&
        preservesOriginal(value, (parsed as Record<string, unknown>)[key]),
    );
  }
  return Object.is(original, parsed);
}
export function recoveryPlan(input: unknown): RecoveryPlan {
  const checked = workspaceEnvelopeSchema.safeParse(input);
  if (!checked.success)
    return {
      original: input,
      proposed: null,
      changes: [],
      issues: checked.error.issues.map(
        (i) => `${i.path.join(".")}: ${i.message}`,
      ),
      reason:
        "Some stored fields need review. A reference-only repair cannot safely restore them.",
    };
  const current = checked.data;
  const validation = stateSchema.safeParse(current);
  const issues = validation.success
    ? []
    : validation.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
  const plan: RecoveryPlan = {
    original: input,
    proposed: null,
    changes: [],
    issues,
  };
  if (!preservesOriginal(input, current))
    return {
      ...plan,
      reason:
        "The saved workspace contains additional fields. Download the original backup for a lossless manual repair.",
    };
  const next = structuredClone(current);
  const unique = new Map<string, State["expeditions"][number]>();
  for (const expedition of next.expeditions) {
    const previous = unique.get(expedition.id);
    if (previous) {
      if (JSON.stringify(previous) !== JSON.stringify(expedition))
        return {
          ...plan,
          reason:
            "Two different expedition entries share an ID. Their data must be reviewed before choosing how to reconnect it.",
        };
      plan.changes.push(
        `Remove an identical duplicate entry for “${expedition.title}”; keep its records.`,
      );
    } else unique.set(expedition.id, expedition);
  }
  next.expeditions = [...unique.values()];
  const ids = next.expeditions.map((e) => e.id);
  const missing = ids.filter((id) => !Object.hasOwn(next.records, id));
  const orphaned = Object.keys(next.records).filter((id) => !ids.includes(id));
  if (missing.length === 1 && orphaned.length === 1) {
    const from = orphaned[0],
      to = missing[0];
    next.records[to] = next.records[from];
    delete next.records[from];
    if (next.activeId === from) next.activeId = to;
    const count = kinds.reduce((s, k) => s + next.records[to][k].length, 0);
    plan.changes.push(
      `Link the ${count} records stored under “${from}” to “${next.expeditions.find((e) => e.id === to)!.title}” (${to}). No records are deleted.`,
    );
  } else if (missing.length || orphaned.length)
    return {
      ...plan,
      reason:
        "Several collections are unmatched, or a collection is missing. Download the original backup so the correct links can be reviewed without guessing.",
    };
  if (!ids.includes(next.activeId)) {
    const previous = next.activeId;
    next.activeId = ids[0];
    plan.changes.push(
      `Open “${next.expeditions[0].title}” instead of the missing active expedition “${previous}”.`,
    );
  }
  const repaired = stateSchema.safeParse(next);
  if (!repaired.success)
    return {
      ...plan,
      reason: "These references cannot be repaired safely by this operation.",
    };
  if (!plan.changes.length)
    return { ...plan, reason: "No reference repair is needed." };
  return { ...plan, proposed: repaired.data };
}
export class WorkspaceReferenceError extends Error {
  readonly plan: RecoveryPlan;
  constructor(input: unknown) {
    super(
      "Your saved expedition references need repair. Your stored records have not been reset.",
    );
    this.name = "WorkspaceReferenceError";
    this.plan = recoveryPlan(input);
  }
}
export function parseLoadedWorkspace(input: unknown): State {
  const checked = stateSchema.safeParse(input);
  if (checked.success) return checked.data;
  if (workspaceEnvelopeSchema.safeParse(input).success)
    throw new WorkspaceReferenceError(input);
  throw checked.error;
}
export function downloadOriginalWorkspace(data: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "adventure-os-original-before-repair.json";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
