import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/dal";
import { PendingWorkspace } from "@/components/pending-workspace";
import { getMyJoinRequest } from "@/lib/auth/join-status";
import { accountTypeFromMetadata } from "@/lib/auth/signup-flow";

export default async function SecurityAccessPage() {
  const context = await requireUser();
  if (context.kind === "inactive") redirect("/access-inactive");
  if (context.kind === "no_membership") {
    const accountType = accountTypeFromMetadata(context.user.user_metadata);
    if (accountType !== "security") redirect(accountType === "host" ? "/app/host" : "/onboarding");
    return <PendingWorkspace role="security" request={await getMyJoinRequest()} />;
  }
  if (context.membership.role !== "security") redirect("/app");
  return <main className="content-shell"><section className="card"><p className="eyebrow">Security and reception</p><h1 className="title">Gate desk</h1><p className="copy">Fast, accountable arrival and departure handling for {context.organization.name}.</p></section><section className="mt-6 grid gap-4 md:grid-cols-3"><Link className="rounded-2xl bg-emerald-700 p-6 text-white shadow-lg shadow-emerald-900/10 transition hover:-translate-y-0.5 hover:bg-emerald-800" href="/app/security/scan"><span className="text-3xl" aria-hidden="true">▣</span><h2 className="mt-5 text-xl font-bold">Scan visit QR</h2><p className="mt-2 text-sm leading-6 text-emerald-50">Check an expected visitor in or an active visitor out.</p></Link><Link className="card transition hover:-translate-y-0.5 hover:border-emerald-300" href="/app/security/new"><span className="text-3xl" aria-hidden="true">＋</span><h2 className="mt-5 text-xl font-bold">New visitor</h2><p className="mt-2 text-sm leading-6 text-slate-500">Register a walk-in or verify a host code.</p></Link><Link className="card transition hover:-translate-y-0.5 hover:border-emerald-300" href="/app/security/inside"><span className="text-3xl" aria-hidden="true">●</span><h2 className="mt-5 text-xl font-bold">Currently inside</h2><p className="mt-2 text-sm leading-6 text-slate-500">See headcount, search active visits and check out.</p></Link></section><aside className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950"><strong>Gate reminder:</strong> Movmak supports verification and accountability. Confirm the person physically before recording entry.</aside></main>;
}
