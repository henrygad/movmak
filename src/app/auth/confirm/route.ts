import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { safeNextPath } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";
import { resolvePostAuthPath } from "@/lib/auth/join-intent";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const next = safeNextPath(url.searchParams.get("next"));
  if (tokenHash && type) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) return NextResponse.redirect(new URL(await resolvePostAuthPath(next, data.user?.user_metadata), url.origin));
  }
  return NextResponse.redirect(new URL("/login?error=confirmation", url.origin));
}
