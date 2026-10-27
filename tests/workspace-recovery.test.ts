import { it, expect } from "vitest";
import { seed } from "../lib/seed";
import {
  recoveryPlan,
  parseLoadedWorkspace,
  WorkspaceReferenceError,
} from "../lib/workspace-recovery";
import { stateSchema } from "../lib/model";
it("repairs a stale active expedition without changing any records or revision", () => {
  const original = seed(),
    bad = { ...original, activeId: "old-expedition-id" };
  expect(() => parseLoadedWorkspace(bad)).toThrow(WorkspaceReferenceError);
  const plan = recoveryPlan(bad);
  expect(plan.proposed?.activeId).toBe(original.activeId);
  expect(plan.proposed?.records).toEqual(original.records);
  expect(plan.proposed?.revision).toBe(original.revision);
  expect(bad.activeId).toBe("old-expedition-id");
});
it("proposes one unmatched collection link without losing tasks, booking payments or source data", () => {
  const original = seed();
  original.records[original.activeId].bookings[0] = {
    ...original.records[original.activeId].bookings[0],
    amount: 1234,
    paid: 321,
    reference: "ACTUAL-SAVED-REF",
  };
  const bad = structuredClone(original);
  bad.expeditions[0].id = "renamed-metadata-id";
  const plan = recoveryPlan(bad);
  expect(plan.proposed).not.toBeNull();
  expect(plan.proposed?.records["renamed-metadata-id"]).toEqual(
    original.records[original.activeId],
  );
  expect(plan.proposed?.activeId).toBe("renamed-metadata-id");
  expect(plan.original).toEqual(bad);
  expect(stateSchema.safeParse(plan.proposed).success).toBe(true);
  expect(Object.keys(bad.records)).toEqual([original.activeId]);
});
it("does not guess between multiple unassociated collections", () => {
  const bad = seed();
  bad.expeditions[0].id = "metadata-id";
  bad.records.extra = structuredClone(bad.records[bad.activeId]);
  const plan = recoveryPlan(bad);
  expect(plan.proposed).toBeNull();
  expect(plan.reason).toContain("without guessing");
  expect(Object.keys(bad.records)).toHaveLength(2);
});
it("only deduplicates exactly identical metadata and preserves all record contents", () => {
  const bad = seed();
  bad.expeditions.push({ ...bad.expeditions[0] });
  const plan = recoveryPlan(bad);
  expect(plan.proposed?.expeditions).toHaveLength(1);
  expect(plan.proposed?.records).toEqual(bad.records);
  bad.expeditions[1].title = "Another expedition with conflicting ID";
  expect(recoveryPlan(bad).proposed).toBeNull();
});
it("never fills missing data with the example seed or discards unknown metadata", () => {
  const bad = seed();
  delete bad.records[bad.activeId];
  expect(recoveryPlan(bad).proposed).toBeNull();
  const extra = {
    ...seed(),
    activeId: "stale",
    privateFutureField: { contents: "Must be preserved" },
  };
  expect(recoveryPlan(extra).proposed).toBeNull();
  expect(recoveryPlan(extra).original).toEqual(extra);
});
it("keeps the save validator strict and provides field-level reference errors", () => {
  const bad = { ...seed(), activeId: "missing" };
  const result = stateSchema.safeParse(bad);
  expect(result.success).toBe(false);
  if (!result.success)
    expect(result.error.issues[0].path).toEqual(["activeId"]);
});
