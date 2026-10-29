import Image from "next/image";
import { requireActiveMembership } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import type { DatabaseWithPendingOnboarding } from "@/types/pending-database.types";
import { OrganizationSettingsForm } from "./settings-form";

export default async function OrganizationSettingsPage() {
  const context = await requireActiveMembership(["admin"]);
  const supabase = await createClient<DatabaseWithPendingOnboarding>();
  const { data: organization, error } = await supabase.from("organizations")
    .select("name, logo_url, website_url").eq("id", context.organization.id).single();
  if (error) throw new Error("Unable to load organization settings.");
  return <main className="content-shell"><section className="card"><p className="eyebrow">Organization settings</p><div className="mt-3 flex items-center gap-4">{organization.logo_url ? <Image unoptimized src={organization.logo_url} alt={`${organization.name} logo`} width={64} height={64} className="size-16 rounded-xl border border-slate-200 object-contain" /> : <span className="flex size-16 items-center justify-center rounded-xl bg-emerald-100 text-2xl font-black text-emerald-900">{organization.name.charAt(0)}</span>}<div><h1 className="title mt-0">Brand and website</h1><p className="copy mt-1">Shown to your staff and invited visitors.</p></div></div></section><OrganizationSettingsForm website={organization.website_url} /></main>;
}
