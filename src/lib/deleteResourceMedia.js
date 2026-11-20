import { ListObjectsV2Command, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getMediaS3 } from "./media/s3.js";
import { deletionPrefixes, scopedKeys } from "./resourcePermanentDelete.mjs";

async function inventory(bucket, prefix) {
  if (!bucket || typeof bucket !== "string") throw new Error("S3 bucket is not configured");
  const result = await getMediaS3().send(new ListObjectsV2Command({
    Bucket: bucket, Prefix: prefix, MaxKeys: 1000,
  }));
  return { truncated: Boolean(result.IsTruncated), objects: (result.Contents ?? []).map(obj => ({
    key: obj.Key, bytes: obj.Size,
  })) };
}

export async function removeResourceMedia(kind, id) {
  const prefixes = deletionPrefixes(kind, id);
  const buckets = { private: process.env.S3_PRIVATE_BUCKET, public: process.env.S3_PUBLIC_BUCKET };
  if (!buckets.private || !buckets.public || buckets.private === buckets.public)
    throw new Error("Неправильная конфигурация рабочих S3-бакетов.");
  const keys = {};
  // Validate both listings completely before deleting anything.
  for (const role of ["private", "public"]) {
    keys[role] = scopedKeys(prefixes[role], await inventory(buckets[role], prefixes[role]));
  }
  for (const role of ["private", "public"]) {
    for (const key of keys[role]) {
      await getMediaS3().send(new DeleteObjectCommand({ Bucket: buckets[role], Key: key }));
    }
  }
  for (const role of ["private", "public"]) {
    const remaining = scopedKeys(prefixes[role], await inventory(buckets[role], prefixes[role]));
    if (remaining.length) throw new Error("В S3 остались файлы. Повторите удаление.");
  }
  return { privateCount: keys.private.length, publicCount: keys.public.length };
}
