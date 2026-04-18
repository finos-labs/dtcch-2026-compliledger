import Database from "better-sqlite3";
import path from "path";
import type { IntentRecord, AnchorRecord } from "./types";

const DB_PATH = path.join(__dirname, "..", "data", "settlementguard.db");

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!db) {
    const fs = require("fs");
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    initSchema(db);
  }
  return db;
}

function initSchema(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS intents (
      id TEXT PRIMARY KEY,
      intent_json TEXT NOT NULL,
      intent_hash TEXT NOT NULL,
      received_at TEXT NOT NULL,
      bundle_json TEXT NOT NULL,
      bundle_root_hash TEXT NOT NULL,
      decision TEXT NOT NULL,
      decision_hash TEXT NOT NULL,
      attestation_json TEXT,
      attestation_hash TEXT,
      signature TEXT,
      anchor_json TEXT,
      anchor_status TEXT DEFAULT 'none',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_intents_bundle_root_hash
      ON intents(bundle_root_hash);

    CREATE INDEX IF NOT EXISTS idx_intents_attestation_hash
      ON intents(attestation_hash);
  `);

  // Additive migrations — safe to run on every startup.
  // ALTER TABLE is a no-op if the column already exists (caught and ignored).
  const migrations = [
    `ALTER TABLE intents ADD COLUMN anchor_status TEXT DEFAULT 'none'`,
  ];
  for (const sql of migrations) {
    try {
      database.exec(sql);
    } catch {
      // Column already present — migration not needed.
    }
  }
}

export function saveIntent(record: IntentRecord): void {
  const database = getDb();
  const stmt = database.prepare(`
    INSERT INTO intents (
      id, intent_json, intent_hash, received_at,
      bundle_json, bundle_root_hash, decision, decision_hash,
      attestation_json, attestation_hash, signature, anchor_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    record.id,
    JSON.stringify(record.intent),
    record.intent_hash,
    record.received_at,
    JSON.stringify(record.bundle),
    record.bundle.bundle_root_hash,
    record.decision_record.decision,
    record.decision_record.decision_hash,
    record.signed_attestation ? JSON.stringify(record.signed_attestation.attestation) : null,
    record.signed_attestation ? record.signed_attestation.attestation_hash : null,
    record.signed_attestation ? record.signed_attestation.signature : null,
    record.anchor ? JSON.stringify(record.anchor) : null
  );
}

export function getIntent(id: string): IntentRecord | null {
  const database = getDb();
  const row = database.prepare("SELECT * FROM intents WHERE id = ?").get(id) as Record<string, string> | undefined;
  if (!row) return null;
  return rowToRecord(row);
}

export function getIntentByBundleHash(bundleRootHash: string): IntentRecord | null {
  const database = getDb();
  const row = database.prepare("SELECT * FROM intents WHERE bundle_root_hash = ?").get(bundleRootHash) as Record<string, string> | undefined;
  if (!row) return null;
  return rowToRecord(row);
}

export function getIntentByAttestationHash(attestationHash: string): IntentRecord | null {
  const database = getDb();
  const row = database.prepare("SELECT * FROM intents WHERE attestation_hash = ?").get(attestationHash) as Record<string, string> | undefined;
  if (!row) return null;
  return rowToRecord(row);
}

export function updateAnchor(id: string, anchor: AnchorRecord): void {
  const database = getDb();
  database.prepare("UPDATE intents SET anchor_json = ?, anchor_status = 'anchored' WHERE id = ?").run(
    JSON.stringify(anchor),
    id
  );
}

export function setAnchorStatus(id: string, status: "pending" | "anchored" | "failed" | "none"): void {
  const database = getDb();
  database.prepare("UPDATE intents SET anchor_status = ? WHERE id = ?").run(status, id);
}

export function getAllIntents(limit = 50, cursor?: string): { items: IntentRecord[]; next_cursor: string | null } {
  const database = getDb();
  let rows: Record<string, string>[];

  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);

  if (cursor) {
    rows = database
      .prepare("SELECT * FROM intents WHERE created_at < ? ORDER BY created_at DESC LIMIT ?")
      .all(cursor, safeLimit + 1) as Record<string, string>[];
  } else {
    rows = database
      .prepare("SELECT * FROM intents ORDER BY created_at DESC LIMIT ?")
      .all(safeLimit + 1) as Record<string, string>[];
  }

  const hasMore = rows.length > safeLimit;
  const page = hasMore ? rows.slice(0, safeLimit) : rows;
  const nextCursor = hasMore ? page[page.length - 1].created_at : null;

  return { items: page.map(rowToRecord), next_cursor: nextCursor };
}

function rowToRecord(row: Record<string, string>): IntentRecord {
  return {
    id: row.id,
    intent: JSON.parse(row.intent_json),
    intent_hash: row.intent_hash,
    received_at: row.received_at,
    bundle: JSON.parse(row.bundle_json),
    decision_record: {
      decision: row.decision as "ALLOW" | "DENY",
      decision_hash: row.decision_hash,
      bundle_root_hash: row.bundle_root_hash,
    },
    signed_attestation: row.attestation_json
      ? {
          attestation: JSON.parse(row.attestation_json),
          attestation_hash: row.attestation_hash,
          signature: row.signature,
        }
      : null,
    anchor: row.anchor_json ? JSON.parse(row.anchor_json) : null,
  };
}
