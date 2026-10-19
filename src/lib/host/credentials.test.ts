import { describe, expect, it } from "vitest";
import { createHostCredentials, hashHostCode, hashInvitationToken } from "./credentials";

const serverSecret = "a-test-only-secret-that-is-longer-than-32-characters";

describe("host credentials", () => {
  it("creates a high-entropy invitation token and six-digit code", () => {
    const credential = createHostCredentials(serverSecret);
    expect(credential.invitationToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(credential.hostCode).toMatch(/^\d{6}$/);
    expect(credential.invitationTokenHash).toMatch(/^\\x[0-9a-f]{64}$/);
    expect(credential.hostCodeHash).toMatch(/^\\x[0-9a-f]{64}$/);
  });

  it("hashes deterministically without exposing the raw credential", () => {
    expect(hashInvitationToken("secret")).not.toContain("secret");
    expect(hashHostCode("123456", serverSecret)).toBe(hashHostCode("123456", serverSecret));
    expect(hashHostCode("123456", serverSecret)).not.toBe(hashHostCode("123457", serverSecret));
  });

  it("issues a distinct invitation token on each request", () => {
    const first = createHostCredentials(serverSecret);
    const second = createHostCredentials(serverSecret);
    expect(first.invitationToken).not.toBe(second.invitationToken);
    expect(first.invitationTokenHash).not.toBe(second.invitationTokenHash);
  });

  it("rejects a weak server pepper", () => {
    expect(() => createHostCredentials("too-short")).toThrow(/strong server credential/);
  });
});
