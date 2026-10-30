import Link from "next/link";
import { notFound } from "next/navigation";
import { VisitDetail } from "@/components/visit-detail";
import { requireActiveMembership } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import type { DatabaseWithPendingOnboarding } from "@/types/pending-database.types";

export default async function SecurityVisitDetailPage({ params }: { params: Promise<{ visitId: string }> }) {
  const { visitId } = await params;
  const context = await requireActiveMembership(["security"]);
  const supabase = await createClient<DatabaseWithPendingOnboarding>();
  const { data, error } = await supabase.rpc("get_authorized_visit_detail", { p_visit_id: visitId });
  if (error) throw new Error("Unable to load this visit.");
  const visit = data[0];
  if (!visit) notFound();

  return <main className="content-shell"><Link className="link-button" href="/app/security/visits">Back to visit history</Link><VisitDetail visit={visit} timezone={context.organization.timezone} /></main>;
}
