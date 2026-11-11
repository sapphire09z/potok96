import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

let client;

function config() {
  const required = [
    "S3_ENDPOINT", "S3_REGION", "S3_PRIVATE_BUCKET",
    "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY",
  ];
  for (const name of required) {
    if (!process.env[name]) {
      throw new Error(`Missing media configuration: ${name}`);
    }
  }
  return {
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION,
    privateBucket: process.env.S3_PRIVATE_BUCKET,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    },
  };
}

export function getMediaS3() {
  if (!client) {
    const c = config();
    client = new S3Client({
      endpoint: c.endpoint,
      region: c.region,
      forcePathStyle: false,
      credentials: c.credentials,
      maxAttempts: 2,
    });
  }
  return client;
}

export async function putPrivate(key, bytes, contentType) {
  const c = config();
  await getMediaS3().send(new PutObjectCommand({
    Bucket: c.privateBucket,
    Key: key,
    Body: bytes,
    ContentType: contentType,
    CacheControl: "private, no-store",
  }));
}

export async function getPrivate(key) {
  const c = config();
  return getMediaS3().send(new GetObjectCommand({
    Bucket: c.privateBucket,
    Key: key,
  }));
}

export async function deletePrivate(key) {
  const c = config();
  await getMediaS3().send(new DeleteObjectCommand({
    Bucket: c.privateBucket,
    Key: key,
  }));
}

function publicBucket() {
  const bucket = process.env.S3_PUBLIC_BUCKET;
  const base = process.env.MEDIA_PUBLIC_BASE_URL;
  if (!bucket || !base || !/^https:\/\/[a-z0-9.-]+\/?$/i.test(base)) {
    throw new Error("S3 public bucket or HTTPS CDN base URL is not configured");
  }
  return bucket;
}

// Best-effort object deletion after a cover is detached from an event. CDN
// edge caches may continue to serve an immutable URL until their TTL expires.
export async function deletePublic(key) {
  await getMediaS3().send(new DeleteObjectCommand({
    Bucket: publicBucket(),
    Key: key,
  }));
}

export function publicMediaUrl(key) {
  publicBucket();
  if (!/^media\/(listings|news|events|orgs|site)\/[a-zA-Z0-9_/-]+\.webp$/.test(key)) {
    throw new Error("Invalid public media key");
  }
  return `${process.env.MEDIA_PUBLIC_BASE_URL.replace(/\/$/, "")}/${key}`;
}

export async function putPublic(key, bytes, contentType = "image/webp") {
  await getMediaS3().send(new PutObjectCommand({
    Bucket: publicBucket(),
    Key: key,
    Body: bytes,
    ContentType: contentType,
    CacheControl: "public, max-age=31536000, immutable",
  }));
}
