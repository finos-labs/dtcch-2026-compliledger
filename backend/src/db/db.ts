import Database from "better-sqlite3";
import path from "path";
import type { IntentRecord, AnchorRecord } from "../core/types";

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
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_intents_bundle_root_hash
      ON intents(bundle_root_hash);

    CREATE INDEX IF NOT EXISTS idx_intents_attestation_hash
      ON intents(attestation_hash);
  `);
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
  database.prepare("UPDATE intents SET anchor_json = ? WHERE id = ?").run(
    JSON.stringify(anchor),
    id
  );
}

export function getAllIntents(): IntentRecord[] {
  const database = getDb();
  const rows = database.prepare("SELECT * FROM intents ORDER BY created_at DESC").all() as Record<string, string>[];
  return rows.map(rowToRecord);
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
