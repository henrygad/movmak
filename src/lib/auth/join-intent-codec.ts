import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";
import { isPlausibleInvitationToken } from "@/lib/auth/invitations";
import { joinPath } from "@/lib/auth/signup-flow";

export const joinIntentMetadataKey = "movmak_join_intent";

function encryptionKey(secret: string) {
  if (secret.trim().length < 32) throw new Error("A strong server credential is required.");
  return createHmac("sha256", secret).update("movmak:member-join:v1").digest();
}

function tokenFromJoinPath(path: string) {
  try {
    const url = new URL(path, "http://movmak.local");
    const token = url.pathname === "/join" ? url.searchParams.get("token") : null;
    return token && isPlausibleInvitationToken(token) ? token : null;
  } catch {
    return null;
  }
}

export function sealJoinIntentPath(path: string, secret: string) {
  const token = tokenFromJoinPath(path);
  if (!token) return null;
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(secret), nonce);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return Buffer.concat([nonce, cipher.getAuthTag(), encrypted]).toString("base64url");
}

export function openJoinIntentPath(value: string, secret: string) {
  try {
    const payload = Buffer.from(value, "base64url");
    if (payload.length < 29) return null;
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(secret), payload.subarray(0, 12));
    decipher.setAuthTag(payload.subarray(12, 28));
    const token = Buffer.concat([decipher.update(payload.subarray(28)), decipher.final()]).toString("utf8");
    return isPlausibleInvitationToken(token) ? joinPath(token) : null;
  } catch {
    return null;
  }
}

export function readSealedJoinIntent(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") return null;
  const value = Reflect.get(metadata, joinIntentMetadataKey);
  return typeof value === "string" && value ? value : null;
}

export function shouldRecoverJoinIntent(fallbackPath: string) {
  return fallbackPath === "/app" || fallbackPath.startsWith("/app/");
}
