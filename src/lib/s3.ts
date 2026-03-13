import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

let s3Client: S3Client | null = null;

export function getS3Client() {
  const region = process.env.AWS_REGION;

  if (!region) {
    throw new Error("AWS_REGION must be configured.");
  }

  if (!s3Client) {
    s3Client = new S3Client({
      region,
      credentials:
        process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
          ? {
              accessKeyId: process.env.AWS_ACCESS_KEY_ID,
              secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            }
          : undefined,
    });
  }

  return s3Client;
}

export async function uploadToS3(
  buffer: Buffer,
  key: string,
  contentType: string,
) {
  const bucketName = process.env.S3_BUCKET_NAME;
  const region = process.env.AWS_REGION;

  if (!region || !bucketName) {
    throw new Error("AWS_REGION and S3_BUCKET_NAME must be configured.");
  }

  await getS3Client().send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }),
  );

  return key;
}
