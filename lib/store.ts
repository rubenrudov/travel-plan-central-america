import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { seed } from "./seed";
import { State, stateSchema, kinds } from "./model";
import { emptyRecords } from "./seed";
let db: DatabaseSync;
function database() {
  if (!db) {
    const dir = process.env.ADVENTURE_DATA_DIR || join(process.cwd(), ".data");
    mkdirSync(dir, { recursive: true });
    db = new DatabaseSync(join(dir, "adventure.sqlite"));
    db.exec(
      "PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS metadata (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, active_id TEXT NOT NULL); CREATE TABLE IF NOT EXISTS expeditions (id TEXT PRIMARY KEY, position INTEGER NOT NULL, data TEXT NOT NULL)",
    );
    for (const k of kinds)
      db.exec(
        `CREATE TABLE IF NOT EXISTS ${k} (id TEXT NOT NULL, expedition_id TEXT NOT NULL REFERENCES expeditions(id) ON DELETE CASCADE, position INTEGER NOT NULL, data TEXT NOT NULL, PRIMARY KEY(expedition_id,id))`,
      );
    if (!db.prepare("SELECT id FROM metadata WHERE id=1").get()) {
      db.exec("BEGIN IMMEDIATE");
      try {
        saveRows(db, seed());
        db.exec("COMMIT");
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    }
  }
  return db;
}
function saveRows(d: DatabaseSync, s: State) {
  d.exec("DELETE FROM expeditions");
  s.expeditions.forEach((e, index) => {
    d.prepare("INSERT INTO expeditions VALUES (?,?,?)").run(
      e.id,
      index,
      JSON.stringify(e),
    );
    for (const k of kinds)
      s.records[e.id][k].forEach((r, i) =>
        d
          .prepare(`INSERT INTO ${k} VALUES (?,?,?,?)`)
          .run(r.id, e.id, i, JSON.stringify(r)),
      );
  });
  d.prepare("INSERT OR REPLACE INTO metadata VALUES (1,?,?)").run(
    s.revision,
    s.activeId,
  );
}
export function readState(): State {
  const d = database();
  const meta = d
    .prepare("SELECT revision,active_id FROM metadata WHERE id=1")
    .get()!;
  const expeditions = d
    .prepare("SELECT data FROM expeditions ORDER BY position")
    .all()
    .map((e) => JSON.parse(e.data as string));
  const records: State["records"] = {};
  for (const e of expeditions) {
    records[e.id] = emptyRecords();
    for (const k of kinds)
      records[e.id][k] = d
        .prepare(
          `SELECT data FROM ${k} WHERE expedition_id=? ORDER BY position`,
        )
        .all(e.id)
        .map((r) => JSON.parse(r.data as string));
  }
  return {
    version: 1,
    revision: Number(meta.revision),
    activeId: meta.active_id as string,
    expeditions,
    records,
  };
}
export function writeState(input: unknown): State {
  const next = stateSchema.parse(input);
  for (const records of Object.values(next.records))
    for (const k of kinds) {
      const ids = records[k].map((r) => r.id);
      if (new Set(ids).size !== ids.length) throw Error("Duplicate record IDs");
    }
  const d = database();
  d.exec("BEGIN IMMEDIATE");
  try {
    const meta = d.prepare("SELECT revision FROM metadata WHERE id=1").get()!;
    if (Number(meta.revision) !== next.revision)
      throw Error("Conflict: reload to get the latest changes");
    const saved = { ...next, revision: next.revision + 1 };
    saveRows(d, saved);
    d.exec("COMMIT");
    return saved;
  } catch (e) {
    d.exec("ROLLBACK");
    throw e;
  }
}
