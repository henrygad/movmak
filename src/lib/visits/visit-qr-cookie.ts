import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";

export const visitQrCookieName = "movmak-visit-qr";
export type StoredVisitQr = { invitationHash: string; qrPayload: string; visitReference: string };

function cookieKey(serverSecret: string) {
  if (serverSecret.trim().length < 32) throw new Error("A strong server credential is required.");
  return createHmac("sha256", serverSecret).update("movmak:visit-qr-cookie:v1").digest();
}

export function sealVisitQr(value: StoredVisitQr, serverSecret: string) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", cookieKey(serverSecret), nonce);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return Buffer.concat([nonce, cipher.getAuthTag(), encrypted]).toString("base64url");
}

export function unsealVisitQr(raw: string, serverSecret: string): StoredVisitQr | null {
  try {
    const payload = Buffer.from(raw, "base64url");
    if (payload.length < 29) return null;
    const decipher = createDecipheriv("aes-256-gcm", cookieKey(serverSecret), payload.subarray(0, 12));
    decipher.setAuthTag(payload.subarray(12, 28));
    const value: unknown = JSON.parse(Buffer.concat([decipher.update(payload.subarray(28)), decipher.final()]).toString("utf8"));
    if (!value || typeof value !== "object") return null;
    const record = value as Record<string, unknown>;
    if (typeof record.invitationHash !== "string" || typeof record.qrPayload !== "string" || typeof record.visitReference !== "string") return null;
    if (!/^\\x[0-9a-f]{64}$/.test(record.invitationHash)
      || !/^movmak:visit:v1:[A-Za-z0-9_-]{43}$/.test(record.qrPayload)
      || !/^VIS-[0-9]{4}-[0-9]{6,}$/.test(record.visitReference)) return null;
    return { invitationHash: record.invitationHash, qrPayload: record.qrPayload, visitReference: record.visitReference };
  } catch {
    return null;
  }
}
