import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),
  LINE_CHANNEL_SECRET: z.string().min(1),
  LINE_CHANNEL_ACCESS_TOKEN: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  DATABASE_SSL: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  SESSION_SECRET: z.string().min(32),
  ADMIN_USERNAME: z.string().min(1),
  ADMIN_PASSWORD_HASH: z.string().min(20),
  USER_RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(20),
  USER_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(5),
});

export type AppConfig = z.infer<typeof schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return schema.parse(env);
}
