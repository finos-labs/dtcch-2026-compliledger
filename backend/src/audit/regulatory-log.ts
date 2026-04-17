import { v4 as uuidv4 } from "uuid";
import { sha256 } from "../crypto";
import { canonicalStringify } from "../crypto";
import type { RegulatoryEvent, RegulatoryEventType } from "../types";
import { logger } from "../logger";

let auditDb: import("better-sqlite3").Database | null = null;

function getAuditDb(): import("better-sqlite3").Database {
  if (!auditDb) {
    const Database = require("better-sqlite3");
    const path = require("path");
    const fs = require("fs");
    const dbPath = path.join(__dirname, "../../data/audit.db");
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    auditDb = new Database(dbPath);
    (auditDb as import("better-sqlite3").Database).pragma("journal_mode = WAL");
    (auditDb as import("better-sqlite3").Database).exec(`
      CREATE TABLE IF NOT EXISTS regulatory_events (
        event_id     TEXT PRIMARY KEY,
        correlation_id TEXT NOT NULL,
        event_type   TEXT NOT NULL,
        timestamp    TEXT NOT NULL,
        actor        TEXT NOT NULL,
        data_hash    TEXT NOT NULL,
        regulation_refs TEXT NOT NULL,
        outcome      TEXT NOT NULL,
        metadata_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_reg_events_correlation ON regulatory_events(correlation_id);
      CREATE INDEX IF NOT EXISTS idx_reg_events_type ON regulatory_events(event_type);
      CREATE INDEX IF NOT EXISTS idx_reg_events_ts ON regulatory_events(timestamp);
    `);
  }
  return auditDb as import("better-sqlite3").Database;
}

export function writeRegulatoryEvent(
  eventType: RegulatoryEventType,
  correlationId: string,
  outcome: RegulatoryEvent["outcome"],
  metadata: Record<string, unknown>,
  opts: {
    actor?: string;
    regulationRefs?: string[];
  } = {}
): RegulatoryEvent {
  const event: RegulatoryEvent = {
    event_id: uuidv4(),
    correlation_id: correlationId,
    event_type: eventType,
    timestamp: new Date().toISOString(),
    actor: opts.actor ?? "settlementguard-service",
    data_hash: sha256(canonicalStringify(metadata)),
    regulation_refs: opts.regulationRefs ?? [],
    outcome,
    metadata,
  };

  try {
    const db = getAuditDb();
    db.prepare(`
      INSERT INTO regulatory_events
        (event_id, correlation_id, event_type, timestamp, actor, data_hash, regulation_refs, outcome, metadata_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      event.event_id,
      event.correlation_id,
      event.event_type,
      event.timestamp,
      event.actor,
      event.data_hash,
      JSON.stringify(event.regulation_refs),
      event.outcome,
      JSON.stringify(event.metadata)
    );
  } catch (err) {
    logger.error({ err: (err as Error).message, event_type: eventType }, "Failed to write regulatory audit event");
  }

  logger.info(
    { event_id: event.event_id, event_type: eventType, correlation_id: correlationId, outcome },
    "Regulatory audit event written"
  );

  return event;
}

export function getRegulatoryEvents(correlationId: string): RegulatoryEvent[] {
  try {
    const db = getAuditDb();
    const rows = db
      .prepare("SELECT * FROM regulatory_events WHERE correlation_id = ? ORDER BY timestamp ASC")
      .all(correlationId) as Array<Record<string, string>>;

    return rows.map((r) => ({
      event_id: r.event_id,
      correlation_id: r.correlation_id,
      event_type: r.event_type as RegulatoryEventType,
      timestamp: r.timestamp,
      actor: r.actor,
      data_hash: r.data_hash,
      regulation_refs: JSON.parse(r.regulation_refs) as string[],
      outcome: r.outcome as RegulatoryEvent["outcome"],
      metadata: JSON.parse(r.metadata_json) as Record<string, unknown>,
    }));
  } catch (err) {
    logger.error({ err: (err as Error).message }, "Failed to read regulatory events");
    return [];
  }
}
