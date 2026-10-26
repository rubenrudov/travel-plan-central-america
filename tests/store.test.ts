import { it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
it("persists relational records and rejects stale transactions", async () => {
  const path = mkdtempSync(join(tmpdir(), "adventure-test-"));
  process.env.ADVENTURE_DATA_DIR = path;
  try {
    const { readState, writeState } = await import("../lib/store");
    const initial = readState();
    const next = structuredClone(initial);
    next.records[next.activeId].tasks.push({
      id: "persist-test",
      title: "Persistent task",
      status: "Todo",
      notes: "",
    });
    const saved = writeState(next);
    expect(readState().records[next.activeId].tasks.at(-1)?.title).toBe(
      "Persistent task",
    );
    expect(saved.revision).toBe(initial.revision + 1);
    expect(() => writeState(initial)).toThrow("Conflict");
    expect(readState().revision).toBe(saved.revision);
  } finally {
    delete process.env.ADVENTURE_DATA_DIR;
    rmSync(path, { recursive: true, force: true });
  }
});
