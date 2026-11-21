import { describe, expect, it } from "vitest";
import { normalizePhoneNumber, phoneNumbersMatch } from "./normalize";

describe("phone normalization", () => {
  it.each([
    ["0803 123 4567", "+2348031234567"],
    ["+234 (803) 123-4567", "+2348031234567"],
    ["002348031234567", "+2348031234567"],
    ["447911123456", "+447911123456"],
  ])("normalizes %s to %s", (input, expected) => {
    expect(normalizePhoneNumber(input)).toEqual({ ok: true, value: expected });
  });

  it("rejects empty, malformed, and implausibly long numbers", () => {
    expect(normalizePhoneNumber("").ok).toBe(false);
    expect(normalizePhoneNumber("0803-ABC-4567").ok).toBe(false);
    expect(normalizePhoneNumber(`+${"1".repeat(16)}`).ok).toBe(false);
  });

  it("compares the normalized values", () => {
    expect(phoneNumbersMatch("0803 123 4567", "+2348031234567")).toBe(true);
    expect(phoneNumbersMatch("0803 123 4567", "0811 111 1111")).toBe(false);
  });
});
