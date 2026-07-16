import { DateTime } from "luxon";
import type { AppConfig } from "./config.js";
import {
  CuratedHoroscopeProvider,
  type HoroscopeProvider,
} from "./horoscope-provider.js";
import type { LineClient, LineMessage } from "./line-client.js";
import {
  deletionConfirmationMessage,
  horoscopeFlexMessage,
  textMessage,
  zodiacPickerMessage,
} from "./messages.js";
import type { Repository } from "./repositories.js";
import type { HoroscopeRequestType, ZodiacKey } from "./types.js";
import { zodiacKeys } from "./types.js";
import { zodiacFromBirthDate, zodiacThai } from "./zodiac.js";

interface WebhookEvent {
  type: string;
  webhookEventId: string;
  replyToken?: string;
  source?: { type: string; userId?: string };
  message?: { type: string; text?: string };
  postback?: { data: string; params?: { date?: string } };
}

export interface WebhookBody {
  destination?: string;
  events: WebhookEvent[];
}

export class WebhookService {
  private readonly horoscopeProvider: HoroscopeProvider;

  constructor(
    private readonly repository: Repository,
    private readonly lineClient: LineClient,
    private readonly config: AppConfig,
    horoscopeProvider?: HoroscopeProvider,
  ) {
    this.horoscopeProvider =
      horoscopeProvider ?? new CuratedHoroscopeProvider(repository);
  }

  async handle(body: WebhookBody): Promise<void> {
    await Promise.all(body.events.map((event) => this.handleEvent(event)));
  }

  private async handleEvent(event: WebhookEvent): Promise<void> {
    if (!event.webhookEventId || !(await this.repository.claimWebhookEvent(event.webhookEventId))) {
      return;
    }

    try {
      await this.processClaimedEvent(event);
      await this.repository.completeWebhookEvent(event.webhookEventId);
    } catch (error) {
      await this.repository.failWebhookEvent(event.webhookEventId, error);
      throw error;
    }
  }

  private async processClaimedEvent(event: WebhookEvent): Promise<void> {
    const userId = event.source?.type === "user" ? event.source.userId : undefined;
    if (!userId || !event.replyToken) return;

    await this.repository.ensureUser(userId);
    const allowed = await this.repository.consumeUserRateLimit(
      userId,
      this.config.USER_RATE_LIMIT_WINDOW_SECONDS,
      this.config.USER_RATE_LIMIT_MAX,
    );
    if (!allowed) {
      await this.reply(event.replyToken, [
        textMessage("กดเร็วไปนิดนะ 😊 รอสักครู่แล้วลองใหม่อีกครั้ง"),
      ]);
      return;
    }

    if (event.type === "follow") {
      await this.reply(event.replyToken, [
        textMessage("ยินดีต้อนรับสู่ดวงรายวัน ✨ เลือกวันเกิดหรือราศีเพื่อเริ่มใช้งาน"),
        zodiacPickerMessage(),
      ]);
      return;
    }

    if (event.type === "postback" && event.postback) {
      await this.handlePostback(userId, event.replyToken, event.postback);
      return;
    }

    if (event.type === "message" && event.message?.type === "text") {
      await this.handleText(userId, event.replyToken, event.message.text ?? "");
    }
  }

  private async handleText(userId: string, replyToken: string, rawText: string): Promise<void> {
    const text = rawText.trim();
    const actions: Record<string, HoroscopeRequestType> = {
      "ดูดวงรายวัน": "daily",
      "ดูดวงความรัก": "love",
      "ดูดวงการงาน": "career",
      "ดูดวงการเงิน": "finance",
      "เลขนำโชค": "lucky_number",
    };
    const requestType = actions[text];
    if (requestType) {
      await this.sendHoroscopeOrPicker(userId, replyToken, requestType);
      return;
    }
    if (text === "วิธีใช้งาน") {
      await this.reply(replyToken, [
        textMessage(
          "วิธีใช้งาน\n1) เลือกเมนูดูดวง\n2) เลือกวันเกิดหรือราศี\n3) รับคำทำนายของวันนี้\n\nพิมพ์ “เปลี่ยนราศี” หรือ “ลบข้อมูล” เพื่อจัดการข้อมูลของคุณ",
        ),
      ]);
      return;
    }
    if (text === "เปลี่ยนราศี") {
      await this.reply(replyToken, [zodiacPickerMessage()]);
      return;
    }
    if (text === "ลบข้อมูล") {
      await this.reply(replyToken, [deletionConfirmationMessage()]);
      return;
    }
    await this.reply(replyToken, [
      textMessage("เลือกบริการจากเมนูด้านล่าง หรือเลือกวันเกิด/ราศีเพื่อดูดวงได้เลย"),
      zodiacPickerMessage(),
    ]);
  }

  private async handlePostback(
    userId: string,
    replyToken: string,
    postback: NonNullable<WebhookEvent["postback"]>,
  ): Promise<void> {
    const params = new URLSearchParams(postback.data);
    const action = params.get("action");

    if (action === "set_zodiac") {
      const zodiac = params.get("zodiac");
      if (!isZodiac(zodiac)) {
        await this.reply(replyToken, [textMessage("ไม่พบราศีที่เลือก กรุณาลองอีกครั้ง")]);
        return;
      }
      await this.repository.setUserZodiac(userId, zodiac);
      const requestType = parseRequestType(params.get("request"));
      await this.sendHoroscope(userId, replyToken, zodiac, requestType);
      return;
    }

    if (action === "set_birthdate") {
      const birthDate = postback.params?.date;
      const parsed = birthDate && DateTime.fromISO(birthDate, { zone: "Asia/Bangkok" });
      if (!parsed || !parsed.isValid || parsed > DateTime.now().setZone("Asia/Bangkok")) {
        await this.reply(replyToken, [textMessage("วันเกิดไม่ถูกต้อง กรุณาเลือกใหม่อีกครั้ง")]);
        return;
      }
      const zodiac = zodiacFromBirthDate(parsed.month, parsed.day);
      await this.repository.setUserZodiac(userId, zodiac, birthDate);
      await this.sendHoroscope(userId, replyToken, zodiac, "daily", [
        textMessage(`วันเกิดนี้อยู่ในราศี${zodiacThai[zodiac]} บันทึกให้แล้วนะ`),
      ]);
      return;
    }

    if (action === "request") {
      await this.sendHoroscopeOrPicker(userId, replyToken, parseRequestType(params.get("type")));
      return;
    }
    if (action === "change_zodiac") {
      await this.reply(replyToken, [zodiacPickerMessage()]);
      return;
    }
    if (action === "confirm_delete") {
      await this.reply(replyToken, [deletionConfirmationMessage()]);
      return;
    }
    if (action === "delete_data") {
      await this.repository.deleteUser(userId);
      await this.reply(replyToken, [
        textMessage("ลบข้อมูลราศี วันเกิด และประวัติการใช้งานของคุณเรียบร้อยแล้ว"),
      ]);
      return;
    }
    await this.reply(replyToken, [textMessage("ไม่พบรายการที่เลือก กรุณาลองใหม่")]);
  }

  private async sendHoroscopeOrPicker(
    userId: string,
    replyToken: string,
    requestType: HoroscopeRequestType,
  ): Promise<void> {
    const zodiac = await this.repository.getUserZodiac(userId);
    if (!zodiac) {
      await this.reply(replyToken, [
        textMessage("ก่อนดูคำทำนาย กรุณาเลือกวันเกิดหรือราศีของคุณ"),
        zodiacPickerMessage(),
      ]);
      return;
    }
    await this.sendHoroscope(userId, replyToken, zodiac, requestType);
  }

  private async sendHoroscope(
    userId: string,
    replyToken: string,
    zodiac: ZodiacKey,
    requestType: HoroscopeRequestType,
    prefix: LineMessage[] = [],
  ): Promise<void> {
    const today = DateTime.now().setZone("Asia/Bangkok").toISODate()!;
    const horoscope = await this.horoscopeProvider.getForDate(today, zodiac);
    await this.repository.logRequest(userId, requestType, zodiac);
    await this.reply(replyToken, [...prefix, horoscopeFlexMessage(horoscope, requestType)]);
  }

  private async reply(replyToken: string, messages: LineMessage[]): Promise<void> {
    await this.lineClient.reply(replyToken, messages.slice(0, 5));
  }
}

function isZodiac(value: string | null): value is ZodiacKey {
  return zodiacKeys.includes(value as ZodiacKey);
}

function parseRequestType(value: string | null): HoroscopeRequestType {
  const valid: HoroscopeRequestType[] = [
    "daily",
    "love",
    "career",
    "finance",
    "lucky_number",
  ];
  return valid.includes(value as HoroscopeRequestType)
    ? (value as HoroscopeRequestType)
    : "daily";
}
