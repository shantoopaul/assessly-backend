import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(5000),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(8).max(12).default(12),
  FRONTEND_URL: z.string().default("http://localhost:3000"),
  GOOGLE_CLIENT_ID: z.string().optional().or(z.literal("")),
  TESTER_ADMIN_NAME: z.string().default("Tester Admin 1"),
  TESTER_ADMIN_EMAIL: z.email().default("testeradmin@gmail.com"),
  TESTER_ADMIN_PASSWORD: z.string().min(8).default("Tester@admin12345"),
  TESTER_REVIEWER_NAME: z.string().default("Tester Reviewer 1"),
  TESTER_REVIEWER_EMAIL: z.email().default("testerreviewer@gmail.com"),
  TESTER_REVIEWER_PASSWORD: z.string().min(8).default("Tester@reviewer12345"),
  TESTER_CANDIDATE_NAME: z.string().default("Tester Candidate 1"),
  TESTER_CANDIDATE_EMAIL: z.email().default("testercandidate@gmail.com"),
  TESTER_CANDIDATE_PASSWORD: z.string().min(8).default("Tester@candidate12345")
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:", z.treeifyError(parsed.error));
  throw new Error("Invalid environment configuration");
}

export const config = parsed.data;