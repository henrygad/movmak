import { describe, expect, it } from "vitest";
import {
  createInvitationCredential,
  hashInvitationToken,
  isOrganizationRole,
  isPlausibleInvitationToken,
  isValidInvitationEmail,
  normalizeEmail,
} from "./invitations";

describe("membership invitation credentials", () => {
  it("creates unpredictable-looking credentials and only exposes a hash for storage", () => {
    const first = createInvitationCredential();
    const second = createInvitationCredential();
    expect(isPlausibleInvitationToken(first.token)).toBe(true);
    expect(first.token).not.toBe(second.token);
    expect(first.tokenHash).toBe(hashInvitationToken(first.token));
    expect(first.tokenHash).toMatch(/^\\x[0-9a-f]{64}$/);
  });

  it.each(["short", "contains spaces", "a".repeat(44)])("rejects malformed token %s", (token) => {
    expect(isPlausibleInvitationToken(token)).toBe(false);
  });
});

describe("membership invitation input", () => {
  it("normalizes and validates an email", () => {
    const email = normalizeEmail(" Resident@Example.com ");
    expect(email).toBe("resident@example.com");
    expect(isValidInvitationEmail(email)).toBe(true);
  });

  it.each(["", "missing-at.example", "name@", "a".repeat(321)])("rejects invalid email %s", (email) => {
    expect(isValidInvitationEmail(email)).toBe(false);
  });

  it("accepts only database organization roles", () => {
    expect(isOrganizationRole("host")).toBe(true);
    expect(isOrganizationRole("security")).toBe(true);
    expect(isOrganizationRole("admin")).toBe(true);
    expect(isOrganizationRole("owner")).toBe(false);
  });
});
