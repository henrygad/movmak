import { createHash, randomBytes } from "node:crypto";
import type { OrganizationRole } from "@/lib/auth/access";

const invitationRoles: readonly OrganizationRole[] = ["admin", "host", "security"];

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function isValidInvitationEmail(value: string) {
  return value.length >= 3 && value.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function isOrganizationRole(value: string): value is OrganizationRole {
  return invitationRoles.includes(value as OrganizationRole);
}

export function createInvitationCredential() {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashInvitationToken(token) };
}

export function hashInvitationToken(token: string) {
  return `\\x${createHash("sha256").update(token, "utf8").digest("hex")}`;
}

export function isPlausibleInvitationToken(token: string) {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}
