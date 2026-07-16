import type pg from "pg";
import type {
  Horoscope,
  HoroscopeRequestType,
  HoroscopeStatus,
  ZodiacKey,
} from "./types.js";

export class Repository {
  constructor(private readonly pool: pg.Pool) {}

  async claimWebhookEvent(eventId: string): Promise<boolean> {
    const result = await this.pool.query(
      `INSERT INTO processed_webhook_events (webhook_event_id)
       VALUES ($1)
       ON CONFLICT (webhook_event_id) DO UPDATE
       SET locked_until = NOW() + INTERVAL '2 minutes', last_error = NULL
       WHERE processed_webhook_events.status = 'processing'
         AND processed_webhook_events.locked_until < NOW()
       RETURNING webhook_event_id`,
      [eventId],
    );
    return result.rowCount === 1;
  }

  async completeWebhookEvent(eventId: string): Promise<void> {
    await this.pool.query(
      `UPDATE processed_webhook_events
       SET status = 'completed', processed_at = NOW(), last_error = NULL
       WHERE webhook_event_id = $1`,
      [eventId],
    );
  }

  async failWebhookEvent(eventId: string, error: unknown): Promise<void> {
    const message = error instanceof Error ? error.message : String(error);
    await this.pool.query(
      `UPDATE processed_webhook_events
       SET locked_until = NOW(), last_error = LEFT($2, 500)
       WHERE webhook_event_id = $1 AND status = 'processing'`,
      [eventId, message],
    );
  }

  async consumeUserRateLimit(
    lineUserId: string,
    windowSeconds: number,
    maxRequests: number,
  ): Promise<boolean> {
    const result = await this.pool.query<{ request_count: number }>(
      `INSERT INTO user_rate_limits (line_user_id, window_started_at, request_count)
       VALUES ($1, NOW(), 1)
       ON CONFLICT (line_user_id) DO UPDATE
       SET window_started_at = CASE
             WHEN user_rate_limits.window_started_at <= NOW() - ($2 * INTERVAL '1 second')
             THEN NOW() ELSE user_rate_limits.window_started_at END,
           request_count = CASE
             WHEN user_rate_limits.window_started_at <= NOW() - ($2 * INTERVAL '1 second')
             THEN 1 ELSE user_rate_limits.request_count + 1 END
       RETURNING request_count`,
      [lineUserId, windowSeconds],
    );
    return (result.rows[0]?.request_count ?? maxRequests + 1) <= maxRequests;
  }

  async ensureUser(lineUserId: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO users (line_user_id, last_used_at)
       VALUES ($1, NOW())
       ON CONFLICT (line_user_id) DO UPDATE SET last_used_at = NOW(), updated_at = NOW()`,
      [lineUserId],
    );
  }

  async getUserZodiac(lineUserId: string): Promise<ZodiacKey | null> {
    const result = await this.pool.query<{ zodiac_sign: ZodiacKey | null }>(
      "SELECT zodiac_sign FROM users WHERE line_user_id = $1",
      [lineUserId],
    );
    return result.rows[0]?.zodiac_sign ?? null;
  }

  async setUserZodiac(
    lineUserId: string,
    zodiac: ZodiacKey,
    birthDate: string | null = null,
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO users (line_user_id, zodiac_sign, birth_date, last_used_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (line_user_id) DO UPDATE
       SET zodiac_sign = EXCLUDED.zodiac_sign,
           birth_date = EXCLUDED.birth_date,
           last_used_at = NOW(),
           updated_at = NOW()`,
      [lineUserId, zodiac, birthDate],
    );
  }

  async deleteUser(lineUserId: string): Promise<void> {
    await this.pool.query("DELETE FROM users WHERE line_user_id = $1", [lineUserId]);
  }

  async logRequest(
    lineUserId: string,
    requestType: HoroscopeRequestType,
    zodiac: ZodiacKey,
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO horoscope_requests (line_user_id, request_type, zodiac_sign)
       VALUES ($1, $2, $3)`,
      [lineUserId, requestType, zodiac],
    );
  }

  async findPublishedHoroscope(
    date: string,
    zodiac: ZodiacKey,
  ): Promise<Horoscope | null> {
    const result = await this.pool.query(
      `SELECT id, horoscope_date, zodiac_sign, overview, career, finance, love,
              health, lucky_color, lucky_number, advice, status
       FROM horoscopes
       WHERE horoscope_date = $1 AND zodiac_sign = $2 AND status = 'published'`,
      [date, zodiac],
    );
    return result.rows[0] ? mapHoroscope(result.rows[0]) : null;
  }

  async listHoroscopes(date?: string): Promise<Horoscope[]> {
    const result = await this.pool.query(
      `SELECT id, horoscope_date, zodiac_sign, overview, career, finance, love,
              health, lucky_color, lucky_number, advice, status
       FROM horoscopes
       WHERE ($1::date IS NULL OR horoscope_date = $1)
       ORDER BY horoscope_date DESC, zodiac_sign`,
      [date ?? null],
    );
    return result.rows.map(mapHoroscope);
  }

  async getHoroscope(id: string): Promise<Horoscope | null> {
    const result = await this.pool.query(
      `SELECT id, horoscope_date, zodiac_sign, overview, career, finance, love,
              health, lucky_color, lucky_number, advice, status
       FROM horoscopes WHERE id = $1`,
      [id],
    );
    return result.rows[0] ? mapHoroscope(result.rows[0]) : null;
  }

  async upsertHoroscope(horoscope: Horoscope): Promise<string> {
    const result = await this.pool.query<{ id: string }>(
      `INSERT INTO horoscopes (
         horoscope_date, zodiac_sign, overview, career, finance, love,
         health, lucky_color, lucky_number, advice, status, published_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
         CASE WHEN $11 = 'published' THEN NOW() ELSE NULL END)
       ON CONFLICT (horoscope_date, zodiac_sign) DO UPDATE SET
         overview = EXCLUDED.overview, career = EXCLUDED.career,
         finance = EXCLUDED.finance, love = EXCLUDED.love,
         health = EXCLUDED.health, lucky_color = EXCLUDED.lucky_color,
         lucky_number = EXCLUDED.lucky_number, advice = EXCLUDED.advice,
         status = EXCLUDED.status,
         published_at = CASE WHEN EXCLUDED.status = 'published' THEN
           COALESCE(horoscopes.published_at, NOW()) ELSE NULL END,
         updated_at = NOW()
       RETURNING id`,
      [
        horoscope.horoscopeDate,
        horoscope.zodiacSign,
        horoscope.overview,
        horoscope.career,
        horoscope.finance,
        horoscope.love,
        horoscope.health,
        horoscope.luckyColor,
        horoscope.luckyNumber,
        horoscope.advice,
        horoscope.status,
      ],
    );
    return result.rows[0]!.id;
  }

  async setHoroscopeStatus(id: string, status: HoroscopeStatus): Promise<void> {
    await this.pool.query(
      `UPDATE horoscopes SET status = $2,
       published_at = CASE WHEN $2 = 'published' THEN NOW() ELSE NULL END,
       updated_at = NOW() WHERE id = $1`,
      [id, status],
    );
  }
}

function mapHoroscope(row: any): Horoscope {
  const rawDate = row.horoscope_date;
  const horoscopeDate =
    rawDate instanceof Date ? rawDate.toISOString().slice(0, 10) : String(rawDate);
  return {
    id: row.id,
    horoscopeDate,
    zodiacSign: row.zodiac_sign,
    overview: row.overview,
    career: row.career,
    finance: row.finance,
    love: row.love,
    health: row.health,
    luckyColor: row.lucky_color,
    luckyNumber: row.lucky_number,
    advice: row.advice,
    status: row.status,
  };
}
