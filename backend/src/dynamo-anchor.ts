import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";
import type { AnchorRecord } from "./types";

const TABLE_NAME = process.env.DYNAMO_TABLE || "sg-commitment-registry";
const AWS_REGION = process.env.AWS_REGION || "us-east-2";

const ddbClient = new DynamoDBClient({ region: AWS_REGION });
const docClient = DynamoDBDocumentClient.from(ddbClient);

export async function anchorToDynamo(
  bundleRootHash: string,
  attestationHash: string,
  intentId: string,
  assetType: string
): Promise<AnchorRecord> {
  const commitmentId = `canton-${uuidv4().slice(0, 8)}`;
  const anchoredAt = new Date().toISOString();
  const txHash = `0x${Buffer.from(attestationHash + anchoredAt).toString("hex").slice(0, 64)}`;

  const item = {
    attestation_hash: attestationHash,
    bundle_root_hash: bundleRootHash,
    commitment_id: commitmentId,
    tx_hash: txHash,
    intent_id: intentId,
    asset_type: assetType,
    anchored_at: anchoredAt,
    network: "canton-global-synchronizer",
  };

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
      ConditionExpression: "attribute_not_exists(attestation_hash)",
    })
  );

  return {
    commitment_id: commitmentId,
    tx_hash: txHash,
    anchored_at: anchoredAt,
    bundle_root_hash: bundleRootHash,
    attestation_hash: attestationHash,
  };
}

export async function lookupByAttestationHash(
  attestationHash: string
): Promise<AnchorRecord | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { attestation_hash: attestationHash },
    })
  );

  if (!result.Item) return null;

  return {
    commitment_id: result.Item.commitment_id as string,
    tx_hash: result.Item.tx_hash as string,
    anchored_at: result.Item.anchored_at as string,
    bundle_root_hash: result.Item.bundle_root_hash as string,
    attestation_hash: result.Item.attestation_hash as string,
  };
}

export async function lookupByBundleHash(
  bundleRootHash: string
): Promise<AnchorRecord | null> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: "bundle-index",
      KeyConditionExpression: "bundle_root_hash = :hash",
      ExpressionAttributeValues: { ":hash": bundleRootHash },
      Limit: 1,
    })
  );

  if (!result.Items || result.Items.length === 0) return null;

  const item = result.Items[0];
  return {
    commitment_id: item.commitment_id as string,
    tx_hash: item.tx_hash as string,
    anchored_at: item.anchored_at as string,
    bundle_root_hash: item.bundle_root_hash as string,
    attestation_hash: item.attestation_hash as string,
  };
}
