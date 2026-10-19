import { requireActiveMembership } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import type { DatabaseWithPendingOnboarding } from "@/types/pending-database.types";
import { NewVisitorForm } from "./new-visitor-form";

export default async function NewVisitorPage() {
  await requireActiveMembership(["security"]);
  const supabase = await createClient<DatabaseWithPendingOnboarding>();
  const { data: hosts, error } = await supabase.rpc("list_active_hosts");
  if (error) throw new Error("Unable to load active hosts.");
  return <main className="content-shell"><NewVisitorForm hosts={hosts ?? []} /></main>;
}
