"use server";

import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { safeNextPath } from "@/lib/auth/access";
import { isOrganizationRole } from "@/lib/auth/invitations";
import { rememberJoinIntent } from "@/lib/auth/join-intent";
import { joinIntentMetadataKey, sealJoinIntentPath } from "@/lib/auth/join-intent-codec";
import { resolveRequestOrigin } from "@/lib/auth/request-origin";

export type SignupState = { error: string | null; submitted: boolean };

export async function signup(_state: SignupState, formData: FormData): Promise<SignupState> {
  const fullName = formData.get("fullName")?.toString().trim() ?? "";
  const email = formData.get("email")?.toString().trim().toLowerCase() ?? "";
  const password = formData.get("password")?.toString() ?? "";
  const accountType = formData.get("accountType")?.toString() ?? "";
  const next = safeNextPath(formData.get("next")?.toString() ?? null);
  if (fullName.length < 2 || fullName.length > 160) return { error: "Enter your full name.", submitted: false };
  if (!email.includes("@") || email.length > 320) return { error: "Enter a valid email address.", submitted: false };
  if (password.length < 12) return { error: "Use at least 12 characters for your password.", submitted: false };
  if (!isOrganizationRole(accountType)) return { error: "Choose a valid account type.", submitted: false };

  const supabase = await createClient();
  const requestHeaders = await headers();
  const origin = resolveRequestOrigin(requestHeaders);
  if (!origin) return { error: "Account confirmation is not configured for this website.", submitted: false };
  const callbackUrl = new URL("/auth/callback", origin);
  callbackUrl.searchParams.set("next", next);
  const serverSecret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const sealedJoinIntent = serverSecret ? sealJoinIntentPath(next, serverSecret) : null;
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        account_type: accountType,
        ...(sealedJoinIntent ? { [joinIntentMetadataKey]: sealedJoinIntent } : {}),
      },
      emailRedirectTo: callbackUrl.toString(),
    },
  });
  if (error) {
    console.error("Supabase signup failed", {
      name: error.name,
      message: error.message,
      code: error.code,
      status: error.status,
    });
    return { error: "We could not create the account. Please try again.", submitted: false };
  }
  try {
    await rememberJoinIntent(next);
  } catch {
    // The email redirect still carries the join path. Do not turn a successful
    // Auth signup into a failure solely because same-browser recovery failed.
  }
  return { error: null, submitted: true };
}
