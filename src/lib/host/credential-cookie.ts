import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";

export const hostCredentialCookieName = "movmak-host-credentials";

export type StoredHostCredentials = {
  userId: string;
  membershipId: string;
  organizationId: string;
  invitationToken: string;
  hostCode: string;
  expiresAt: string;
};

export function hostCredentialsBelongTo(value: StoredHostCredentials, identity: {
  userId: string; membershipId: string; organizationId: string;
}) {
  return value.userId === identity.userId
    && value.membershipId === identity.membershipId
    && value.organizationId === identity.organizationId;
}

function cookieKey(serverSecret: string) {
  if (serverSecret.trim().length < 32) throw new Error("A strong server credential is required.");
  return createHmac("sha256", serverSecret).update("movmak:host-cookie:v1").digest();
}

export function sealHostCredentials(value: StoredHostCredentials, serverSecret: string) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", cookieKey(serverSecret), nonce);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return Buffer.concat([nonce, cipher.getAuthTag(), encrypted]).toString("base64url");
}

export function unsealHostCredentials(raw: string, serverSecret: string, now = Date.now()): StoredHostCredentials | null {
  try {
    const payload = Buffer.from(raw, "base64url");
    if (payload.length < 29) return null;
    const decipher = createDecipheriv("aes-256-gcm", cookieKey(serverSecret), payload.subarray(0, 12));
    decipher.setAuthTag(payload.subarray(12, 28));
    const value: unknown = JSON.parse(Buffer.concat([decipher.update(payload.subarray(28)), decipher.final()]).toString("utf8"));
    if (!value || typeof value !== "object") return null;
    const record = value as Record<string, unknown>;
    if (typeof record.userId !== "string" || typeof record.membershipId !== "string" || typeof record.organizationId !== "string"
      || typeof record.invitationToken !== "string" || typeof record.hostCode !== "string" || typeof record.expiresAt !== "string") return null;
    const expiry = Date.parse(record.expiresAt);
    // Legacy six-digit credentials can survive for only the existing
    // five-minute expiry window. Newly issued credentials are four digits.
    if (!/^[A-Za-z0-9_-]{43}$/.test(record.invitationToken) || !/^(?:\d{4}|\d{6})$/.test(record.hostCode)
      || !Number.isFinite(expiry) || expiry <= now || expiry > now + 5 * 60_000 + 5_000) return null;
    return {
      userId: record.userId,
      membershipId: record.membershipId,
      organizationId: record.organizationId,
      invitationToken: record.invitationToken,
      hostCode: record.hostCode,
      expiresAt: record.expiresAt,
    };
  } catch {
    return null;
  }
}
