import { describe, expect, it } from "vitest";
import { joinIntentMetadataKey, openJoinIntentPath, readSealedJoinIntent, sealJoinIntentPath, shouldRecoverJoinIntent } from "./join-intent-codec";

const secret = "test-only-secret-that-is-longer-than-thirty-two-characters";
const token = "A".repeat(43);

describe("organization join intent recovery", () => {
  it("encrypts a valid join path and recovers it after authentication", () => {
    const sealed = sealJoinIntentPath(`/join?token=${token}`, secret);
    expect(sealed).not.toContain(token);
    expect(openJoinIntentPath(sealed ?? "", secret)).toBe(`/join?token=${token}`);
  });

  it("rejects unrelated paths, tampering, and the wrong server secret", () => {
    expect(sealJoinIntentPath("/app/host", secret)).toBeNull();
    const sealed = sealJoinIntentPath(`/join?token=${token}`, secret) ?? "";
    const tampered = `${sealed.startsWith("A") ? "B" : "A"}${sealed.slice(1)}`;
    expect(openJoinIntentPath(tampered, secret)).toBeNull();
    expect(openJoinIntentPath(sealed, `${secret}-different`)).toBeNull();
  });

  it("reads only the encrypted metadata field", () => {
    expect(readSealedJoinIntent({ [joinIntentMetadataKey]: "sealed-value" })).toBe("sealed-value");
    expect(readSealedJoinIntent({ [joinIntentMetadataKey]: 42 })).toBeNull();
    expect(readSealedJoinIntent(null)).toBeNull();
  });

  it("recovers an invitation before opening any protected workspace", () => {
    expect(shouldRecoverJoinIntent("/app")).toBe(true);
    expect(shouldRecoverJoinIntent("/app/host")).toBe(true);
    expect(shouldRecoverJoinIntent("/app/security")).toBe(true);
    expect(shouldRecoverJoinIntent("/onboarding")).toBe(false);
    expect(shouldRecoverJoinIntent("/application")).toBe(false);
  });
});
