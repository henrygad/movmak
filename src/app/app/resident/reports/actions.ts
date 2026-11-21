"use server";

import { revalidatePath } from "next/cache";
import { requireActiveMembership } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import type { DatabaseWithPendingOnboarding } from "@/types/pending-database.types";

export type ReportState = { error: string | null; message: string | null };

export async function submitSecurityReport(_state: ReportState, formData: FormData): Promise<ReportState> {
  await requireActiveMembership(["host"]);
  const category = formData.get("category")?.toString().trim() ?? "";
  const details = formData.get("details")?.toString().trim() ?? "";
  if (category.length < 2 || category.length > 80) return { error: "Choose a report category.", message: null };
  if (details.length < 10 || details.length > 2000) return { error: "Enter between 10 and 2,000 characters.", message: null };
  const supabase = await createClient<DatabaseWithPendingOnboarding>();
  const { error } = await supabase.rpc("submit_resident_security_report", { p_category: category, p_details: details });
  if (error) return { error: "The security report could not be submitted.", message: null };
  revalidatePath("/app/resident/reports");
  return { error: null, message: "Security report submitted." };
}
