import { describe, expect, it, vi } from "vitest";
import type { AppConfig } from "../src/config.js";
import type { LineClient, LineMessage } from "../src/line-client.js";
import type { Repository } from "../src/repositories.js";
import { WebhookService } from "../src/webhook-service.js";

const config = {
  USER_RATE_LIMIT_WINDOW_SECONDS: 20,
  USER_RATE_LIMIT_MAX: 5,
} as AppConfig;

function setup() {
  const repository = {
    claimWebhookEvent: vi.fn().mockResolvedValue(true),
    completeWebhookEvent: vi.fn().mockResolvedValue(undefined),
    failWebhookEvent: vi.fn().mockResolvedValue(undefined),
    ensureUser: vi.fn().mockResolvedValue(undefined),
    consumeUserRateLimit: vi.fn().mockResolvedValue(true),
    setUserZodiac: vi.fn().mockResolvedValue(undefined),
    findPublishedHoroscope: vi.fn().mockResolvedValue(null),
    logRequest: vi.fn().mockResolvedValue(undefined),
    getUserZodiac: vi.fn().mockResolvedValue(null),
  };
  const replies: LineMessage[][] = [];
  const lineClient: LineClient = {
    reply: vi.fn(async (_token, messages) => {
      replies.push(messages);
    }),
  };
  const service = new WebhookService(
    repository as unknown as Repository,
    lineClient,
    config,
  );
  return { service, repository, lineClient, replies };
}

describe("WebhookService", () => {
  it("ignores a duplicate webhook event", async () => {
    const { service, repository, lineClient } = setup();
    repository.claimWebhookEvent.mockResolvedValue(false);
    await service.handle({
      events: [
        {
          type: "message",
          webhookEventId: "event-1",
          replyToken: "reply",
          source: { type: "user", userId: "U1" },
          message: { type: "text", text: "ดูดวงรายวัน" },
        },
      ],
    });
    expect(lineClient.reply).not.toHaveBeenCalled();
    expect(repository.ensureUser).not.toHaveBeenCalled();
  });

  it("stores a selected zodiac and replies with the safe fallback horoscope", async () => {
    const { service, repository, replies } = setup();
    await service.handle({
      events: [
        {
          type: "postback",
          webhookEventId: "event-2",
          replyToken: "reply",
          source: { type: "user", userId: "U1" },
          postback: { data: "action=set_zodiac&zodiac=aries&request=daily" },
        },
      ],
    });
    expect(repository.setUserZodiac).toHaveBeenCalledWith("U1", "aries");
    expect(repository.logRequest).toHaveBeenCalledWith("U1", "daily", "aries");
    expect(replies[0]?.[0]?.type).toBe("flex");
    expect(JSON.stringify(replies[0])).toContain(
      "คำทำนายนี้จัดทำขึ้นเพื่อความบันเทิงและเป็นแนวทางทั่วไปเท่านั้น",
    );
    expect(repository.completeWebhookEvent).toHaveBeenCalledWith("event-2");
  });

  it("throttles bursts before processing the action", async () => {
    const { service, repository, replies } = setup();
    repository.consumeUserRateLimit.mockResolvedValue(false);
    await service.handle({
      events: [
        {
          type: "message",
          webhookEventId: "event-3",
          replyToken: "reply",
          source: { type: "user", userId: "U1" },
          message: { type: "text", text: "ดูดวงรายวัน" },
        },
      ],
    });
    expect(JSON.stringify(replies[0])).toContain("กดเร็วไปนิด");
    expect(repository.getUserZodiac).not.toHaveBeenCalled();
  });
});
