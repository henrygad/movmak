import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/auth/access";
import { resolvePostAuthPath } from "@/lib/auth/join-intent";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNextPath(url.searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(await resolvePostAuthPath(next, data.user?.user_metadata), url.origin));
  }

  return NextResponse.redirect(new URL("/login?error=callback", url.origin));
}
