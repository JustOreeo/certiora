import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().optional(),
  NEXTAUTH_URL: z.string().url().optional(),
  NEXTAUTH_SECRET: z.string().optional(),
  REDIS_URL: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
});

const parsed = envSchema.safeParse({
  NODE_ENV: process.env.NODE_ENV,
  DATABASE_URL: process.env.DATABASE_URL,
  NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
  REDIS_URL: process.env.REDIS_URL,
  S3_BUCKET: process.env.S3_BUCKET,
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
};
