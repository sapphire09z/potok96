import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

let client;

function config() {
  const keys = [
    "S3_ENDPOINT",
    "S3_REGION",
    "S3_PRIVATE_BUCKET",
    "S3_ACCESS_KEY_ID",
    "S3_SECRET_ACCESS_KEY",
  ];

  for (const key of keys) {
    if (!process.env[key]) {
      throw new Error(`Missing media configuration: ${key}`);
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
