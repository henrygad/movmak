"use server";
import { revalidatePath } from "next/cache";
import { requireActiveMembership } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import type { DatabaseWithPendingOnboarding } from "@/types/pending-database.types";
export async function updateReportStatus(formData: FormData) {
  await requireActiveMembership(["admin"]);
  const reportId = formData.get("reportId")?.toString() ?? "";
  const status = formData.get("status")?.toString() ?? "";
  if (!['submitted', 'under_review', 'resolved'].includes(status)) return;
  const supabase = await createClient<DatabaseWithPendingOnboarding>();
  await supabase.rpc("update_security_report_status", { p_report_id: reportId, p_status: status });
  revalidatePath("/app/admin/security-reports");
}
