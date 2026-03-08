import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  NEXTAUTH_URL: z.string().url().optional(),
  NEXTAUTH_SECRET: z.string().min(32, "NEXTAUTH_SECRET must be at least 32 characters"),
  REDIS_URL: z.string().optional(),
  S3_ENDPOINT: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
});

const parsed = envSchema.safeParse({
  NODE_ENV: process.env.NODE_ENV,
  DATABASE_URL: process.env.DATABASE_URL,
  NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
  REDIS_URL: process.env.REDIS_URL,
  S3_ENDPOINT: process.env.S3_ENDPOINT,
  S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID,
  S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY,
  S3_BUCKET: process.env.S3_BUCKET,
  S3_REGION: process.env.S3_REGION,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
});

if (!parsed.success) {
  console.error("Invalid env:", parsed.error.flatten());
  throw new Error("Invalid environment variables");
}

export const config = {
  ...parsed.data,
  nodeEnv: parsed.data.NODE_ENV,
  redisUrl: parsed.data.REDIS_URL ?? undefined,
  s3: {
    endpoint: parsed.data.S3_ENDPOINT,
    accessKeyId: parsed.data.S3_ACCESS_KEY_ID,
    secretAccessKey: parsed.data.S3_SECRET_ACCESS_KEY,
    bucket: parsed.data.S3_BUCKET,
    region: parsed.data.S3_REGION ?? "auto",
  },
};
