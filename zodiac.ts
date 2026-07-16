import type { ZodiacKey } from "./types.js";

export const zodiacThai: Record<ZodiacKey, string> = {
  aries: "เมษ",
  taurus: "พฤษภ",
  gemini: "เมถุน",
  cancer: "กรกฎ",
  leo: "สิงห์",
  virgo: "กันย์",
  libra: "ตุลย์",
  scorpio: "พิจิก",
  sagittarius: "ธนู",
  capricorn: "มังกร",
  aquarius: "กุมภ์",
  pisces: "มีน",
};

export function zodiacFromBirthDate(month: number, day: number): ZodiacKey {
  const value = month * 100 + day;
  if (value >= 321 && value <= 419) return "aries";
  if (value >= 420 && value <= 520) return "taurus";
  if (value >= 521 && value <= 620) return "gemini";
  if (value >= 621 && value <= 722) return "cancer";
  if (value >= 723 && value <= 822) return "leo";
  if (value >= 823 && value <= 922) return "virgo";
  if (value >= 923 && value <= 1022) return "libra";
  if (value >= 1023 && value <= 1121) return "scorpio";
  if (value >= 1122 && value <= 1221) return "sagittarius";
  if (value >= 1222 || value <= 119) return "capricorn";
  if (value >= 120 && value <= 218) return "aquarius";
  return "pisces";
}
