"use server";

import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { safeNextPath } from "@/lib/auth/access";
import { isOrganizationRole } from "@/lib/auth/invitations";
import { rememberJoinIntent } from "@/lib/auth/join-intent";

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
  const origin = requestHeaders.get("origin") ?? "http://localhost:3000";
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, account_type: accountType },
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
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
