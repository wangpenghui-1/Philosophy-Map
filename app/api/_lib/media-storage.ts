import { HeadBucketCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

let client: S3Client | undefined;

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw Object.assign(new Error(`${name} is not configured.`), { status: 503 });
  return value;
}

export function isMediaStorageConfigured() {
  return Boolean(process.env.S3_ENDPOINT && process.env.S3_BUCKET && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY);
}

export function isMediaUploadPolicyEnabled() {
  return process.env.MEDIA_UPLOADS_ENABLED === "1";
}

export function areMediaUploadsEnabled() {
  return isMediaUploadPolicyEnabled()
    && isMediaStorageConfigured()
    && Boolean(process.env.MEDIA_SCAN_ENDPOINT && process.env.MEDIA_SCAN_TOKEN);
}

export function assertMediaUploadsEnabled() {
  if (!isMediaUploadPolicyEnabled()) {
    throw Object.assign(new Error("媒体上传已按零付费生产策略关闭；现有静态媒体仍可正常使用。"), { status: 503 });
  }
  if (!isMediaStorageConfigured()) {
    throw Object.assign(new Error("媒体对象存储尚未配置。"), { status: 503 });
  }
  if (!(process.env.MEDIA_SCAN_ENDPOINT && process.env.MEDIA_SCAN_TOKEN)) {
    throw Object.assign(new Error("媒体扫描服务尚未配置，禁止接收未扫描文件。"), { status: 503 });
  }
}

function storageClient() {
  if (!client) client = new S3Client({
    endpoint: required("S3_ENDPOINT"),
    region: process.env.S3_REGION?.trim() || "auto",
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "1",
    credentials: { accessKeyId: required("S3_ACCESS_KEY_ID"), secretAccessKey: required("S3_SECRET_ACCESS_KEY") },
  });
  return client;
}

function bucket() {
  return required("S3_BUCKET");
}

export async function createMediaUploadUrl(input: {
  storageKey: string;
  mimeType: string;
  byteSize: number;
  checksumSha256: string;
}) {
  const command = new PutObjectCommand({
    Bucket: bucket(), Key: input.storageKey, ContentType: input.mimeType,
    ContentLength: input.byteSize, ChecksumSHA256: input.checksumSha256,
    Metadata: { "atlas-upload": "media-asset" },
  });
  return getSignedUrl(storageClient(), command, { expiresIn: 15 * 60 });
}

export async function inspectMediaObject(storageKey: string) {
  return storageClient().send(new HeadObjectCommand({ Bucket: bucket(), Key: storageKey, ChecksumMode: "ENABLED" }));
}

export async function probeMediaStorage() {
  await storageClient().send(new HeadBucketCommand({ Bucket: bucket() }), { requestTimeout: 3_000 });
}

export function publicMediaUrl(storageKey: string) {
  const base = process.env.S3_PUBLIC_BASE_URL?.trim();
  return base ? `${base.replace(/\/$/, "")}/${storageKey.split("/").map(encodeURIComponent).join("/")}` : null;
}
