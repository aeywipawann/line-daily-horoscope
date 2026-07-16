export interface LineMessage {
  type: string;
  [key: string]: unknown;
}

export interface LineClient {
  reply(replyToken: string, messages: LineMessage[]): Promise<void>;
}

export class MessagingApiClient implements LineClient {
  constructor(private readonly channelAccessToken: string) {}

  async reply(replyToken: string, messages: LineMessage[]): Promise<void> {
    const response = await fetch("https://api.line.me/v2/bot/message/reply", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.channelAccessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ replyToken, messages }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) {
      throw new Error(`LINE reply failed (${response.status}): ${await response.text()}`);
    }
  }
}
