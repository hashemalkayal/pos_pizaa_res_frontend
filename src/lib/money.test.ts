import { describe, expect, it } from "vitest";
import { formatMoney, fromFils, isMoney, isMoneyInput, isPercentInput, toFils } from "./money";

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

describe("fils (exact integer arithmetic on amounts)", () => {
  it.each([
    ["4.5", 4500],
    ["0.050", 50],
    ["16.500", 16500],
    ["-2.5", -2500],
    ["9999999.999", 9999999999],
  ])("toFils(%s) = %d", (input, expected) => {
    expect(toFils(input)).toBe(expected);
  });

  it("adds and subtracts without floating point error", () => {
    expect(fromFils(toFils("0.1") + toFils("0.2"))).toBe("0.300");
    expect(fromFils(toFils("10.000") - toFils("7.550"))).toBe("2.450");
    expect(fromFils(-250)).toBe("-0.250");
  });

  it("rejects what is not an amount", () => {
    expect(() => toFils("1.2345")).toThrow(RangeError);
    expect(() => fromFils(0.5)).toThrow(RangeError);
  });
});

describe("cashier input rules (the backend's)", () => {
  it("money: non-negative, at most 7 integer digits and 3 decimals", () => {
    for (const value of ["0", "2", "2.5", "2.500", "9999999.999"]) expect(isMoneyInput(value)).toBe(true);
    for (const value of ["", "-1", "2.", ".5", "2.5000", "10000000", "1,5", "abc"]) expect(isMoneyInput(value)).toBe(false);
  });

  it("percent: 0–100 with at most 2 decimals", () => {
    for (const value of ["0", "10", "12.5", "99.99", "100", "100.00"]) expect(isPercentInput(value)).toBe(true);
    for (const value of ["", "-5", "100.01", "101", "12.345", "1e2", "abc"]) expect(isPercentInput(value)).toBe(false);
  });
});
