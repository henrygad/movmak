import { describe, expect, it } from "vitest";
import { createVisitQrCredential, parseVisitQrPayload } from "./credentials";
import { phoneNumbersMatch, totalGroupSize, validateVisitorDetails } from "./validation";

describe("visit credentials", () => {
  it("creates opaque QR payloads and hashes", () => {
    const value = createVisitQrCredential();
    expect(value.payload).toMatch(/^movmak:visit:v1:[A-Za-z0-9_-]{43}$/);
    expect(value.tokenHash).toMatch(/^\\x[0-9a-f]{64}$/);
    expect(value.tokenHash).not.toContain(value.payload);
  });

  it("creates a different QR credential for each visit", () => {
    const first = createVisitQrCredential();
    const second = createVisitQrCredential();
    expect(first.payload).not.toBe(second.payload);
    expect(first.tokenHash).not.toBe(second.tokenHash);
  });

  it("accepts prefixed and manual raw tokens", () => {
    const token = "a".repeat(43);
    expect(parseVisitQrPayload(`movmak:visit:v1:${token}`)).toBe(token);
    expect(parseVisitQrPayload(token)).toBe(token);
    expect(parseVisitQrPayload("bad")).toBeNull();
  });
});

describe("visitor validation", () => {
  const valid = { fullName: "Ada Visitor", phone: "+2348000000000", purpose: "Business meeting", companionCount: 0 };
  it("accepts valid details", () => expect(validateVisitorDetails(valid)).toBeNull());
  it("adds the primary visitor to companions", () => expect(totalGroupSize(3)).toBe(4));
  it("requires the visitor phone confirmation to match", () => {
    expect(phoneNumbersMatch("+234 800 000 0000", " +234 800 000 0000 ")).toBe(true);
    expect(phoneNumbersMatch("+2348000000000", "+2348111111111")).toBe(false);
  });
  it("rejects invalid companion counts", () => expect(validateVisitorDetails({ ...valid, companionCount: -1 })).toMatch(/between/));
  it("rejects empty identifying details", () => expect(validateVisitorDetails({ ...valid, fullName: " " })).toMatch(/full name/));
  it("rejects missing phone and purpose", () => {
    expect(validateVisitorDetails({ ...valid, phone: " " })).toMatch(/phone/);
    expect(validateVisitorDetails({ ...valid, purpose: " " })).toMatch(/purpose/);
  });
  it("rejects overlong details and fractional companion counts", () => {
    expect(validateVisitorDetails({ ...valid, fullName: "A".repeat(161) })).not.toBeNull();
    expect(validateVisitorDetails({ ...valid, phone: "1".repeat(41) })).not.toBeNull();
    expect(validateVisitorDetails({ ...valid, purpose: "Unlisted reason" })).not.toBeNull();
    expect(validateVisitorDetails({ ...valid, companionCount: 1.5 })).not.toBeNull();
  });
});
