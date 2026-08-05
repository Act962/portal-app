import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    CORS_ORIGIN: z.url(),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    // Armazenamento de mídia (S3-compatível). Defaults miram o MinIO local, para
    // dev/build/CI funcionarem sem configuração; produção (R2) sobrescreve tudo.
    S3_ENDPOINT: z.url().default("http://localhost:9000"),
    S3_REGION: z.string().min(1).default("us-east-1"),
    S3_ACCESS_KEY_ID: z.string().min(1).default("minioadmin"),
    S3_SECRET_ACCESS_KEY: z.string().min(1).default("minioadmin"),
    S3_BUCKET: z.string().min(1).default("portal-media"),
    S3_PUBLIC_URL: z.url().default("http://localhost:9000/portal-media"),
    S3_FORCE_PATH_STYLE: z
      .enum(["true", "false"])
      .default("true")
      .transform((value) => value === "true"),
  },
  runtimeEnv: process.env,
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
