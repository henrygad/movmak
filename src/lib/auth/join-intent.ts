import "server-only";

import { cookies } from "next/headers";
import { openJoinIntentPath, readSealedJoinIntent, sealJoinIntentPath, shouldRecoverJoinIntent } from "@/lib/auth/join-intent-codec";

const cookieName = "movmak-member-join";
const maximumAgeSeconds = 31 * 24 * 60 * 60;

export async function rememberJoinIntent(path: string) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const sealedIntent = secret ? sealJoinIntentPath(path, secret) : null;
  if (!sealedIntent) return;
  (await cookies()).set(cookieName, sealedIntent, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: maximumAgeSeconds,
  });
}

export async function resolvePostAuthPath(fallbackPath: string, userMetadata?: unknown) {
  const cookieStore = await cookies();
  const raw = cookieStore.get(cookieName)?.value;
  cookieStore.set(cookieName, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  if (!shouldRecoverJoinIntent(fallbackPath)) return fallbackPath;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) return fallbackPath;
  const metadataIntent = readSealedJoinIntent(userMetadata);
  return (raw ? openJoinIntentPath(raw, secret) : null)
    ?? (metadataIntent ? openJoinIntentPath(metadataIntent, secret) : null)
    ?? fallbackPath;
}

export function recoverJoinIntentPath(userMetadata: unknown) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const metadataIntent = readSealedJoinIntent(userMetadata);
  return secret && metadataIntent ? openJoinIntentPath(metadataIntent, secret) : null;
}

export async function clearJoinIntent() {
  (await cookies()).set(cookieName, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
}
