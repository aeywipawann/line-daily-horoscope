import { fallbackHoroscope } from "./messages.js";
import type { Repository } from "./repositories.js";
import type { Horoscope, ZodiacKey } from "./types.js";

/**
 * Stable boundary for horoscope sources. A future AI provider can implement this
 * interface while preserving the webhook, safety policy, and message rendering.
 */
export interface HoroscopeProvider {
  getForDate(date: string, zodiac: ZodiacKey): Promise<Horoscope>;
}

export class CuratedHoroscopeProvider implements HoroscopeProvider {
  constructor(private readonly repository: Repository) {}

  async getForDate(date: string, zodiac: ZodiacKey): Promise<Horoscope> {
    return (
      (await this.repository.findPublishedHoroscope(date, zodiac)) ??
      fallbackHoroscope(date, zodiac)
    );
  }
}
