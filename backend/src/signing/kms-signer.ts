import { KMSClient, SignCommand, GetPublicKeyCommand, SigningAlgorithmSpec } from "@aws-sdk/client-kms";
import { logger } from "../logger";

const KMS_KEY_ID = process.env.KMS_SIGNING_KEY_ID || "";
const KMS_REGION = process.env.AWS_REGION || "us-east-2";
const USE_KMS = process.env.SG_USE_KMS === "true" && Boolean(KMS_KEY_ID);

const ALGORITHM = SigningAlgorithmSpec.ECDSA_SHA_256;

let kmsClient: KMSClient | null = null;

function getKMSClient(): KMSClient {
  if (!kmsClient) {
    kmsClient = new KMSClient({ region: KMS_REGION });
  }
  return kmsClient;
}

export function isKMSEnabled(): boolean {
  return USE_KMS;
}

export async function signWithKMS(dataHash: string): Promise<string> {
  if (!USE_KMS) {
    throw new Error("KMS signing is not enabled (SG_USE_KMS != true or KMS_SIGNING_KEY_ID not set)");
  }

  const client = getKMSClient();
  const messageBytes = Buffer.from(dataHash, "utf8");

  const cmd = new SignCommand({
    KeyId: KMS_KEY_ID,
    Message: messageBytes,
    MessageType: "RAW",
    SigningAlgorithm: ALGORITHM,
  });

  try {
    const response = await client.send(cmd);
    if (!response.Signature) throw new Error("KMS Sign returned no signature bytes");

    logger.info(
      { key_id: KMS_KEY_ID, algorithm: ALGORITHM },
      "KMS signing operation completed"
    );

    return Buffer.from(response.Signature).toString("base64");
  } catch (err) {
    logger.error({ err: (err as Error).message, key_id: KMS_KEY_ID }, "KMS signing failed");
    throw err;
  }
}

export async function getKMSPublicKey(): Promise<string> {
  if (!USE_KMS) throw new Error("KMS not enabled");

  const client = getKMSClient();
  const cmd = new GetPublicKeyCommand({ KeyId: KMS_KEY_ID });

  try {
    const response = await client.send(cmd);
    if (!response.PublicKey) throw new Error("KMS GetPublicKey returned no key bytes");
    return Buffer.from(response.PublicKey).toString("base64");
  } catch (err) {
    logger.error({ err: (err as Error).message }, "KMS GetPublicKey failed");
    throw err;
  }
}

export function getKMSKeyMetadata(): { key_id: string; algorithm: string; provider: string } {
  return {
    key_id: KMS_KEY_ID || "not-configured",
    algorithm: ALGORITHM,
    provider: "aws-kms",
  };
}
