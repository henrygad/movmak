"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import type { DatabaseWithPendingOnboarding } from "@/types/pending-database.types";

export type PhoneSyncResult = { error: string | null; phone: string | null };

export async function syncVerifiedPhone(): Promise<PhoneSyncResult> {
  const context = await requireUser();
  const supabase = await createClient<DatabaseWithPendingOnboarding>();

  // Re-fetch through Auth after OTP verification. The browser never supplies a
  // trusted "verified" flag or the value persisted to the profile.
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user || user.id !== context.user.id) {
    return { error: "Your verified phone could not be confirmed.", phone: null };
  }

  const { data, error } = await supabase.rpc("sync_my_verified_phone");
  if (error || !data) return { error: "Your verified phone could not be saved.", phone: null };
  revalidatePath("/app", "layout");
  return { error: null, phone: data };
}
