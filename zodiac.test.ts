import { describe, expect, it } from "vitest";
import { zodiacFromBirthDate } from "../src/zodiac.js";

describe("zodiacFromBirthDate", () => {
  it.each([
    [3, 21, "aries"],
    [4, 20, "taurus"],
    [5, 21, "gemini"],
    [6, 21, "cancer"],
    [7, 23, "leo"],
    [8, 23, "virgo"],
    [9, 23, "libra"],
    [10, 23, "scorpio"],
    [11, 22, "sagittarius"],
    [12, 22, "capricorn"],
    [1, 20, "aquarius"],
    [2, 19, "pisces"],
  ] as const)("maps %i/%i to %s", (month, day, expected) => {
    expect(zodiacFromBirthDate(month, day)).toBe(expected);
  });

  it("handles zodiac boundary days", () => {
    expect(zodiacFromBirthDate(3, 20)).toBe("pisces");
    expect(zodiacFromBirthDate(12, 21)).toBe("sagittarius");
  });
});
