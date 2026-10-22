import "server-only";

import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { isPlausibleInvitationToken } from "@/lib/auth/invitations";
import { joinPath } from "@/lib/auth/signup-flow";

const cookieName = "movmak-member-join";
const maximumAgeSeconds = 31 * 24 * 60 * 60;

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

function sealToken(token: string, secret: string) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(secret), nonce);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return Buffer.concat([nonce, cipher.getAuthTag(), encrypted]).toString("base64url");
}

function unsealToken(value: string, secret: string) {
  try {
    const payload = Buffer.from(value, "base64url");
    if (payload.length < 29) return null;
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(secret), payload.subarray(0, 12));
    decipher.setAuthTag(payload.subarray(12, 28));
    const token = Buffer.concat([decipher.update(payload.subarray(28)), decipher.final()]).toString("utf8");
    return isPlausibleInvitationToken(token) ? token : null;
  } catch {
    return null;
  }
}

export async function rememberJoinIntent(path: string) {
  const token = tokenFromJoinPath(path);
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!token || !secret) return;
  (await cookies()).set(cookieName, sealToken(token, secret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: maximumAgeSeconds,
  });
}

export async function resolvePostAuthPath(fallbackPath: string) {
  const cookieStore = await cookies();
  const raw = cookieStore.get(cookieName)?.value;
  cookieStore.set(cookieName, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  if (fallbackPath !== "/app" || !raw) return fallbackPath;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = secret ? unsealToken(raw, secret) : null;
  return token ? joinPath(token) : fallbackPath;
}

export async function clearJoinIntent() {
  (await cookies()).set(cookieName, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
}
