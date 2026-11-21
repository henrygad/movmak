import Link from "next/link";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/dal";
import { logout } from "@/app/login/actions";
import { AppNavigation } from "@/components/app-navigation";
import { accountTypeFromMetadata, workspacePathForRole } from "@/lib/auth/signup-flow";
import { createClient } from "@/lib/supabase/server";
import type { DatabaseWithPendingOnboarding } from "@/types/pending-database.types";

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const context = await requireUser();
  if (context.kind === "inactive") redirect("/access-inactive");
  if (context.kind === "no_membership") {
    const accountType = accountTypeFromMetadata(context.user.user_metadata);
    if (accountType !== "host" && accountType !== "security") redirect("/onboarding");
    return (
      <div className="min-h-screen bg-slate-50">
        <header className="app-header">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-8">
            <Link href={workspacePathForRole(accountType)} className="wordmark" aria-label="Movmak home"><span className="wordmark-mark">M</span><span>Movmak</span></Link>
            <div className="flex shrink-0 items-center gap-3"><span className="status-badge status-expected capitalize">{accountType === "host" ? "resident" : accountType} account</span><form action={logout}><button className="button-ghost" type="submit">Sign out</button></form></div>
          </div>
        </header>
        {children}
      </div>
    );
  }
  let organizationAddressComplete = true;
  if (context.membership.role === "admin") {
    const supabase = await createClient<DatabaseWithPendingOnboarding>();
    const { data } = await supabase.from("organizations")
      .select("physical_address").eq("id", context.organization.id).maybeSingle();
    organizationAddressComplete = Boolean(data?.physical_address);
  }
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="app-header">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-8">
          <div className="flex min-w-0 items-center gap-3"><Link href="/app" className="wordmark" aria-label="Movmak home"><span className="wordmark-mark">M</span><span>Movmak</span></Link><span className="hidden h-6 w-px bg-slate-200 sm:block" /><p className="truncate text-sm text-slate-500">{context.organization.name}</p></div>
          <div className="flex shrink-0 items-center gap-3"><span className="status-badge status-active capitalize">{context.membership.role === "host" ? "resident" : context.membership.role}</span><form action={logout}><button className="button-ghost" type="submit">Sign out</button></form></div>
        </div>
        <div className="mx-auto max-w-6xl px-4 sm:px-8"><AppNavigation role={context.membership.role} /></div>
      </header>
      {!organizationAddressComplete ? <div className="mx-auto mt-5 w-[calc(100%-2rem)] max-w-6xl rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 sm:w-[calc(100%-4rem)]" role="alert"><strong>Organization address required.</strong> Add it in <Link className="font-bold underline" href="/app/admin/settings">Settings</Link> before new residents can apply. Existing access and gate operations continue.</div> : null}
      {children}
    </div>
  );
}
