"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { DatabaseWithPendingOnboarding } from "@/types/pending-database.types";

export type PhoneSyncResult = { error: string | null; phone: string | null };

export async function syncVerifiedPhone(): Promise<PhoneSyncResult> {
  const supabase = await createClient<DatabaseWithPendingOnboarding>();

  // Use one server client and one trusted Auth lookup. Creating another client
  // through requireUser() can make both clients try to rotate the same refresh
  // token immediately after OTP verification.
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return { error: "Your verified phone could not be confirmed.", phone: null };
  }

  const { data, error } = await supabase.rpc("sync_my_verified_phone");
  if (error || !data) return { error: "Your verified phone could not be saved.", phone: null };
  revalidatePath("/app", "layout");
  return { error: null, phone: data };
}
