// Read-only S3 inventory limited to exactly one CMS record's object prefix.
// Listing at most 1000 objects per bucket; pagination beyond the cap is
// deliberately not performed by an interactive admin page.
import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getMediaS3 } from "./media/s3.js";
import { MAX_LISTED_OBJECTS, mediaPrefix } from "./contentCleanupPreview.mjs";

async function listBucket(bucket, prefix) {
  if (typeof bucket !== "string" || !bucket.trim()) {
    throw new Error("Missing S3 bucket configuration");
  }
  const result = await getMediaS3().send(new ListObjectsV2Command({
    Bucket: bucket,
    Prefix: prefix,
    MaxKeys: MAX_LISTED_OBJECTS,
  }));
  const objects = (result.Contents ?? []).map(item => ({
    key: item.Key,
    bytes: item.Size,
  }));
  return { objects, truncated: Boolean(result.IsTruncated) };
}

export async function listContentMedia(kind, id) {
  const prefix = mediaPrefix(kind, id); // validates both components
  const [privateListing, publicListing] = await Promise.all([
    listBucket(process.env.S3_PRIVATE_BUCKET, prefix),
    listBucket(process.env.S3_PUBLIC_BUCKET, prefix),
  ]);
  return { privateListing, publicListing };
}
