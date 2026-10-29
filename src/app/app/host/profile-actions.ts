"use server";

import { revalidatePath } from "next/cache";
import { requireActiveMembership } from "@/lib/auth/dal";
import { validateHostProfile } from "@/lib/host/profile";
import { createClient } from "@/lib/supabase/server";
import type { DatabaseWithPendingOnboarding } from "@/types/pending-database.types";

export type HostProfileState = { error: string | null; message: string | null };

export async function updateHostProfile(_state: HostProfileState, formData: FormData): Promise<HostProfileState> {
  const context = await requireActiveMembership(["host"]);
  const fullName = formData.get("fullName")?.toString() ?? "";
  const phone = formData.get("phone")?.toString() ?? "";
  const address = formData.get("address")?.toString() ?? "";
  const validationError = validateHostProfile(fullName, phone, address);
  if (validationError) return { error: validationError, message: null };

  const supabase = await createClient<DatabaseWithPendingOnboarding>();
  const { data, error } = await supabase.from("user_profiles")
    .update({ full_name: fullName.trim(), phone: phone.trim(), address: address.trim() })
    .eq("user_id", context.user.id)
    .select("user_id")
    .maybeSingle();
  if (error) {
    console.error("Host profile update failed", { code: error.code, message: error.message });
    return { error: "Your profile could not be saved. Please try again.", message: null };
  }
  if (!data) {
    console.error("Host profile update matched no profile row.");
    return { error: "Your profile could not be saved. Please try again.", message: null };
  }
  revalidatePath("/app/host");
  return { error: null, message: "Your profile was updated." };
}
