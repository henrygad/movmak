import { describe, expect, it } from "vitest";
import { createVisitQrCredential, parseVisitQrPayload } from "./credentials";
import { validateVisitorDetails } from "./validation";

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
  const valid = { fullName: "Ada Visitor", phone: "+2348000000000", purpose: "Meeting", groupSize: 1 };
  it("accepts valid details", () => expect(validateVisitorDetails(valid)).toBeNull());
  it("rejects invalid group sizes", () => expect(validateVisitorDetails({ ...valid, groupSize: 0 })).toMatch(/between/));
  it("rejects empty identifying details", () => expect(validateVisitorDetails({ ...valid, fullName: " " })).toMatch(/full name/));
  it("rejects missing phone and purpose", () => {
    expect(validateVisitorDetails({ ...valid, phone: " " })).toMatch(/phone/);
    expect(validateVisitorDetails({ ...valid, purpose: " " })).toMatch(/purpose/);
  });
  it("rejects overlong details and fractional group sizes", () => {
    expect(validateVisitorDetails({ ...valid, fullName: "A".repeat(161) })).not.toBeNull();
    expect(validateVisitorDetails({ ...valid, phone: "1".repeat(41) })).not.toBeNull();
    expect(validateVisitorDetails({ ...valid, purpose: "A".repeat(501) })).not.toBeNull();
    expect(validateVisitorDetails({ ...valid, groupSize: 1.5 })).not.toBeNull();
  });
});
