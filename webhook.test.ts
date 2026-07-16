import { createHmac } from "node:crypto";
import type pg from "pg";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import type { AppConfig } from "../src/config.js";
import type { LineMessage } from "../src/line-client.js";
import type { Repository } from "../src/repositories.js";
import type { WebhookService } from "../src/webhook-service.js";

const config: AppConfig = {
  NODE_ENV: "test",
  PORT: 3000,
  APP_BASE_URL: "http://localhost:3000",
  LINE_CHANNEL_SECRET: "test-secret",
  LINE_CHANNEL_ACCESS_TOKEN: "test-token",
  DATABASE_URL: "postgresql://unused",
  DATABASE_SSL: false,
  SESSION_SECRET: "12345678901234567890123456789012",
  ADMIN_USERNAME: "admin",
  ADMIN_PASSWORD_HASH: "$2b$12$1234567890123456789012345678901234567890123456789012",
  USER_RATE_LIMIT_WINDOW_SECONDS: 20,
  USER_RATE_LIMIT_MAX: 5,
};

function testApp(handle = vi.fn().mockResolvedValue(undefined)) {
  const pool = { query: vi.fn() } as unknown as pg.Pool;
  const repository = {} as Repository;
  const webhookService = { handle } as unknown as WebhookService;
  return { app: createApp(config, pool, repository, webhookService), handle };
}

describe("POST /webhook", () => {
  it("rejects a request with an invalid signature", async () => {
    const { app, handle } = testApp();
    await request(app)
      .post("/webhook")
      .set("Content-Type", "application/json")
      .set("x-line-signature", "invalid")
      .send({ events: [] })
      .expect(401);
    expect(handle).not.toHaveBeenCalled();
  });

  it("accepts signed verification requests with an empty events array", async () => {
    const { app, handle } = testApp();
    const raw = JSON.stringify({ destination: "Utest", events: [] });
    const signature = createHmac("sha256", config.LINE_CHANNEL_SECRET)
      .update(raw)
      .digest("base64");
    await request(app)
      .post("/webhook")
      .set("Content-Type", "application/json")
      .set("x-line-signature", signature)
      .send(raw)
      .expect(200);
    expect(handle).toHaveBeenCalledWith({ destination: "Utest", events: [] });
  });
});

export const unusedLineMessageTypeCheck: LineMessage = { type: "text", text: "ok" };
