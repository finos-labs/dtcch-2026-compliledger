import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import type { AnchorRecord } from "./types";

const TABLE_NAME = process.env.DYNAMO_TABLE || "sg-commitment-registry";
const AWS_REGION = process.env.AWS_REGION || "us-east-2";

const ddbClient = new DynamoDBClient({ region: AWS_REGION });
const docClient = DynamoDBDocumentClient.from(ddbClient);

const ANCHOR_DB_PATH = path.join(__dirname, "..", "data", "anchors.db");
let anchorDb: Database.Database | null = null;

function getAnchorDb(): Database.Database {
  if (!anchorDb) {
    const dir = path.dirname(ANCHOR_DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    anchorDb = new Database(ANCHOR_DB_PATH);
    anchorDb.pragma("journal_mode = WAL");
    anchorDb.exec(`
      CREATE TABLE IF NOT EXISTS anchors (
        attestation_hash TEXT PRIMARY KEY,
        bundle_root_hash TEXT NOT NULL,
        commitment_id TEXT NOT NULL,
        tx_hash TEXT,
        intent_id TEXT NOT NULL,
        asset_type TEXT NOT NULL,
        anchored_at TEXT NOT NULL,
        network TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_anchors_bundle ON anchors(bundle_root_hash);
    `);
  }
  return anchorDb;
}

function buildAnchorFields(_bundleRootHash: string, _attestationHash: string, _intentId: string) {
  const commitmentId = `sg-anchor-${uuidv4()}`;
  const anchoredAt = new Date().toISOString();
  return { commitmentId, anchoredAt };
}

function anchorToSqlite(
  bundleRootHash: string,
  attestationHash: string,
  intentId: string,
  assetType: string,
  cantonTxHash?: string
): AnchorRecord {
  const { commitmentId, anchoredAt } = buildAnchorFields(bundleRootHash, attestationHash, intentId);
  const txHash = cantonTxHash ?? null;
  const network = cantonTxHash ? "canton-global-synchronizer" : "local-fallback";
  const db = getAnchorDb();
  db.prepare(`
    INSERT OR IGNORE INTO anchors (attestation_hash, bundle_root_hash, commitment_id, tx_hash, intent_id, asset_type, anchored_at, network)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(attestationHash, bundleRootHash, commitmentId, txHash, intentId, assetType, anchoredAt, network);
  return { commitment_id: commitmentId, tx_hash: txHash ?? commitmentId, anchored_at: anchoredAt, bundle_root_hash: bundleRootHash, attestation_hash: attestationHash };
}

function lookupSqliteByAttestation(attestationHash: string): AnchorRecord | null {
  const row = getAnchorDb().prepare("SELECT * FROM anchors WHERE attestation_hash = ?").get(attestationHash) as Record<string, string> | undefined;
  if (!row) return null;
  return { commitment_id: row.commitment_id, tx_hash: row.tx_hash, anchored_at: row.anchored_at, bundle_root_hash: row.bundle_root_hash, attestation_hash: row.attestation_hash };
}

function lookupSqliteByBundle(bundleRootHash: string): AnchorRecord | null {
  const row = getAnchorDb().prepare("SELECT * FROM anchors WHERE bundle_root_hash = ? LIMIT 1").get(bundleRootHash) as Record<string, string> | undefined;
  if (!row) return null;
  return { commitment_id: row.commitment_id, tx_hash: row.tx_hash, anchored_at: row.anchored_at, bundle_root_hash: row.bundle_root_hash, attestation_hash: row.attestation_hash };
}

export async function anchorToDynamo(
  bundleRootHash: string,
  attestationHash: string,
  intentId: string,
  assetType: string,
  cantonTxHash?: string
): Promise<AnchorRecord> {
  const { commitmentId, anchoredAt } = buildAnchorFields(bundleRootHash, attestationHash, intentId);
  const network = cantonTxHash ? "canton-global-synchronizer" : "local-fallback";

  const item = {
    attestation_hash: attestationHash,
    bundle_root_hash: bundleRootHash,
    commitment_id: commitmentId,
    tx_hash: cantonTxHash ?? null,
    intent_id: intentId,
    asset_type: assetType,
    anchored_at: anchoredAt,
    network,
  };

  const DDB_TIMEOUT_MS = 8000;
  const ddbCall = docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
      ConditionExpression: "attribute_not_exists(attestation_hash)",
    })
  );
  const timeoutSignal = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("DynamoDB write timed out")), DDB_TIMEOUT_MS)
  );
  ddbCall.catch(() => {});
  try {
    await Promise.race([ddbCall, timeoutSignal]);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("DynamoDB write failed, using SQLite fallback:", msg);
    return anchorToSqlite(bundleRootHash, attestationHash, intentId, assetType, cantonTxHash);
  }

  try {
    anchorToSqlite(bundleRootHash, attestationHash, intentId, assetType, cantonTxHash);
  } catch (sqlErr) {
    console.warn("SQLite mirror write failed (non-fatal):", (sqlErr as Error).message);
  }

  return {
    commitment_id: commitmentId,
    tx_hash: cantonTxHash ?? commitmentId,
    anchored_at: anchoredAt,
    bundle_root_hash: bundleRootHash,
    attestation_hash: attestationHash,
  };
}

export async function lookupByAttestationHash(
  attestationHash: string
): Promise<AnchorRecord | null> {
  try {
    const result = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { attestation_hash: attestationHash },
      })
    );
    if (result.Item) {
      return {
        commitment_id: result.Item.commitment_id as string,
        tx_hash: result.Item.tx_hash as string,
        anchored_at: result.Item.anchored_at as string,
        bundle_root_hash: result.Item.bundle_root_hash as string,
        attestation_hash: result.Item.attestation_hash as string,
      };
    }
  } catch (err: unknown) {
    console.warn("DynamoDB read failed, using SQLite fallback:", (err as Error).message);
  }
  return lookupSqliteByAttestation(attestationHash);
}

export async function lookupByBundleHash(
  bundleRootHash: string
): Promise<AnchorRecord | null> {
  try {
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: "bundle-index",
        KeyConditionExpression: "bundle_root_hash = :hash",
        ExpressionAttributeValues: { ":hash": bundleRootHash },
        Limit: 1,
      })
    );
    if (result.Items && result.Items.length > 0) {
      const item = result.Items[0];
      return {
        commitment_id: item.commitment_id as string,
        tx_hash: item.tx_hash as string,
        anchored_at: item.anchored_at as string,
        bundle_root_hash: item.bundle_root_hash as string,
        attestation_hash: item.attestation_hash as string,
      };
    }
  } catch (err: unknown) {
    console.warn("DynamoDB query failed, using SQLite fallback:", (err as Error).message);
  }
  return lookupSqliteByBundle(bundleRootHash);
}
