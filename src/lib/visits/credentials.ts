import { createHash, randomBytes } from "node:crypto";

const qrPrefix = "movmak:visit:v1:";

export function createVisitQrCredential() {
  const token = randomBytes(32).toString("base64url");
  return { payload: `${qrPrefix}${token}`, tokenHash: hashVisitQrToken(token) };
}

export function parseVisitQrPayload(payload: string) {
  const token = payload.trim().startsWith(qrPrefix) ? payload.trim().slice(qrPrefix.length) : payload.trim();
  return /^[A-Za-z0-9_-]{43}$/.test(token) ? token : null;
}

export function hashVisitQrToken(token: string) {
  return `\\x${createHash("sha256").update(token, "utf8").digest("hex")}`;
}
