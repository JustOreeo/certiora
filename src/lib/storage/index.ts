import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config } from "@/config/env";

function buildS3Client(): S3Client | null {
  if (!config.s3.accessKeyId || !config.s3.secretAccessKey || !config.s3.bucket) {
    return null;
  }
  return new S3Client({
    region: config.s3.region,
    ...(config.s3.endpoint ? { endpoint: config.s3.endpoint, forcePathStyle: true } : {}),
    credentials: {
      accessKeyId: config.s3.accessKeyId,
      secretAccessKey: config.s3.secretAccessKey,
    },
  });
}

let _client: S3Client | null | undefined;

function getClient(): S3Client {
  if (_client === undefined) _client = buildS3Client();
  if (!_client) throw new Error("S3 storage is not configured. Set S3_* environment variables.");
  return _client;
}

export function isStorageConfigured(): boolean {
  return !!(config.s3.accessKeyId && config.s3.secretAccessKey && config.s3.bucket);
}

export function buildFileKey(tenantId: string, sourceMaterialId: string, fileName: string): string {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${tenantId}/source-materials/${sourceMaterialId}/${safeName}`;
}

export function buildCardImageKey(
  tenantId: string,
  cardId: string,
  side: "front" | "back",
  fileName: string
): string {
  const ext = fileName.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "") ?? "png";
  const uuid = crypto.randomUUID().slice(0, 8);
  return `${tenantId}/flashcard-images/${cardId}/${side}_${uuid}.${ext}`;
}

export async function getPresignedDownloadUrl(
  fileKey: string,
  expiresInSeconds = 3600
): Promise<string> {
  const client = getClient();
  const command = new GetObjectCommand({
    Bucket: config.s3.bucket!,
    Key: fileKey,
  });
  return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

export async function getPresignedUploadUrl(
  fileKey: string,
  contentType = "application/pdf",
  expiresInSeconds = 3600
): Promise<string> {
  const client = getClient();
  const command = new PutObjectCommand({
    Bucket: config.s3.bucket!,
    Key: fileKey,
    ContentType: contentType,
  });
  return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

export async function downloadFileAsBuffer(fileKey: string): Promise<Buffer> {
  const client = getClient();
  const command = new GetObjectCommand({
    Bucket: config.s3.bucket!,
    Key: fileKey,
  });
  const response = await client.send(command);
  if (!response.Body) throw new Error(`No body for key: ${fileKey}`);

  const chunks: Uint8Array[] = [];
  for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function deleteFile(fileKey: string): Promise<void> {
  const client = getClient();
  const command = new DeleteObjectCommand({
    Bucket: config.s3.bucket!,
    Key: fileKey,
  });
  await client.send(command);
}
