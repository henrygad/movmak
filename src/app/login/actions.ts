"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath, validateLoginCredentials } from "@/lib/auth/access";
import { hostCredentialCookieName } from "@/lib/host/credential-cookie";
import { cookies } from "next/headers";
import { resolvePostAuthPath } from "@/lib/auth/join-intent";

export type LoginState = { error: string | null };

export async function login(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = formData.get("email");
  const password = formData.get("password");
  const next = safeNextPath(formData.get("next")?.toString() ?? null);

  const validationError = validateLoginCredentials(email, password);
  if (validationError) return { error: validationError };

  if (typeof email !== "string" || typeof password !== "string") {
    return { error: "Enter your sign-in details." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    console.error("Supabase login failed", {
      name: error.name,
      message: error.message,
      code: error.code,
      status: error.status,
    });
    return { error: "The email or password is incorrect." };
  }

  redirect(await resolvePostAuthPath(next, data.user?.user_metadata));
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  (await cookies()).set(hostCredentialCookieName, "", { path: "/app/host", maxAge: 0 });
  redirect("/login");
}
