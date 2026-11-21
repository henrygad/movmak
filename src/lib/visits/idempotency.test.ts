import { describe, expect, it } from "vitest";
import {
  createIdempotentVisitQrCredential,
  fingerprintVisitInput,
  hashIdempotencyKey,
  idempotencyKeyPattern,
} from "./idempotency";

describe("visit idempotency", () => {
  const key = "9ba35421-b64f-4fb6-882c-26ae21e9fbe2";

  it("accepts UUID v4 keys and rejects arbitrary values", () => {
    expect(idempotencyKeyPattern.test(key)).toBe(true);
    expect(idempotencyKeyPattern.test("retry-me")).toBe(false);
  });

  it("reproduces a credential only for the same scope and key", () => {
    const first = createIdempotentVisitQrCredential("secret", "invite:a", key);
    expect(createIdempotentVisitQrCredential("secret", "invite:a", key)).toEqual(first);
    expect(createIdempotentVisitQrCredential("secret", "invite:b", key)).not.toEqual(first);
    expect(first.payload).toMatch(/^movmak:visit:v1:[A-Za-z0-9_-]{43}$/);
  });

  it("creates canonical input fingerprints", () => {
    const first = fingerprintVisitInput({ fullName: " Ada   Obi ", phone: "+2348031234567", purpose: "Business meeting", companionCount: 1 });
    const retry = fingerprintVisitInput({ fullName: "Ada Obi", phone: "+2348031234567", purpose: "Business meeting", companionCount: 1 });
    const changed = fingerprintVisitInput({ fullName: "Ada Obi", phone: "+2348031234567", purpose: "Business meeting", companionCount: 2 });
    expect(retry).toBe(first);
    expect(changed).not.toBe(first);
    expect(hashIdempotencyKey(key)).toMatch(/^\\x[0-9a-f]{64}$/);
  });
});
