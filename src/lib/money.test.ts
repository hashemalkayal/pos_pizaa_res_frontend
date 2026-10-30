import { describe, expect, it } from "vitest";
import { formatMoney, isMoney } from "./money";

describe("formatMoney (JOD, exactly 3 decimals, no floating point)", () => {
  it.each([
    ["4", "4.000"],
    ["4.5", "4.500"],
    ["16.500", "16.500"],
    ["0.05", "0.050"],
    ["1234.5", "1,234.500"],
    ["1234567.891", "1,234,567.891"],
    ["007.1", "7.100"],
    ["-2.5", "-2.500"],
    ["-0.000", "0.000"],
  ])("%s → %s", (input, expected) => {
    expect(formatMoney(input)).toBe(expected);
  });

  it("keeps precision beyond floating point range", () => {
    expect(formatMoney("90071992547409930.125")).toBe("90,071,992,547,409,930.125");
  });

  it("rejects values that are not backend money strings", () => {
    for (const value of ["", "abc", "1.2345", "1,000.000", "1e3"]) {
      expect(isMoney(value)).toBe(false);
      expect(() => formatMoney(value)).toThrow(RangeError);
    }
  });
});
