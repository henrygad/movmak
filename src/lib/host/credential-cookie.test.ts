import { describe, expect, it } from "vitest";
import { hostCredentialsBelongTo, sealHostCredentials, unsealHostCredentials, type StoredHostCredentials } from "./credential-cookie";

const secret = "a-test-only-server-key-that-is-longer-than-32-characters";
const now = Date.parse("2026-10-19T12:00:00.000Z");
const value: StoredHostCredentials = {
  userId: "user-one", membershipId: "membership-one", organizationId: "organization-one",
  invitationToken: "a".repeat(43), hostCode: "012345",
  expiresAt: new Date(now + 5 * 60_000).toISOString(),
};

describe("encrypted host credential cookie", () => {
  it("restores the current pair without exposing raw credentials in the cookie", () => {
    const sealed = sealHostCredentials(value, secret);
    expect(sealed).not.toContain(value.invitationToken);
    expect(sealed).not.toContain(value.hostCode);
    expect(unsealHostCredentials(sealed, secret, now)).toEqual(value);
  });

  it("rejects tampering and a different server key", () => {
    const sealed = sealHostCredentials(value, secret);
    expect(unsealHostCredentials(`${sealed[0] === "A" ? "B" : "A"}${sealed.slice(1)}`, secret, now)).toBeNull();
    expect(unsealHostCredentials(sealed, `${secret}-different`, now)).toBeNull();
  });

  it("rejects an expired pair", () => {
    expect(unsealHostCredentials(sealHostCredentials(value, secret), secret, now + 5 * 60_000)).toBeNull();
  });

  it("binds a restored pair to the signed-in user, membership, and organization", () => {
    expect(hostCredentialsBelongTo(value, value)).toBe(true);
    expect(hostCredentialsBelongTo(value, { ...value, userId: "another-user" })).toBe(false);
    expect(hostCredentialsBelongTo(value, { ...value, membershipId: "another-membership" })).toBe(false);
    expect(hostCredentialsBelongTo(value, { ...value, organizationId: "another-organization" })).toBe(false);
  });
});
