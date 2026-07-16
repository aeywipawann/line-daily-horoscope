import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyLineSignature } from "../src/signature.js";

describe("verifyLineSignature", () => {
  const secret = "test-channel-secret";
  const body = Buffer.from('{"events":[]}');

  it("accepts a valid LINE HMAC signature", () => {
    const signature = createHmac("sha256", secret).update(body).digest("base64");
    expect(verifyLineSignature(body, signature, secret)).toBe(true);
  });

  it("rejects missing, invalid and body-mismatched signatures", () => {
    expect(verifyLineSignature(body, undefined, secret)).toBe(false);
    expect(verifyLineSignature(body, "invalid", secret)).toBe(false);
    const signature = createHmac("sha256", secret)
      .update(Buffer.from("different"))
      .digest("base64");
    expect(verifyLineSignature(body, signature, secret)).toBe(false);
  });
});
