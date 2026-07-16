export const zodiacKeys = [
  "aries",
  "taurus",
  "gemini",
  "cancer",
  "leo",
  "virgo",
  "libra",
  "scorpio",
  "sagittarius",
  "capricorn",
  "aquarius",
  "pisces",
] as const;

export type ZodiacKey = (typeof zodiacKeys)[number];
export type HoroscopeStatus = "draft" | "published";
export type HoroscopeRequestType =
  | "daily"
  | "love"
  | "career"
  | "finance"
  | "lucky_number";

export interface Horoscope {
  id?: string;
  horoscopeDate: string;
  zodiacSign: ZodiacKey;
  overview: string;
  career: string;
  finance: string;
  love: string;
  health: string;
  luckyColor: string;
  luckyNumber: string;
  advice: string;
  status: HoroscopeStatus;
}
