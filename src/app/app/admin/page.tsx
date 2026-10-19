import Link from "next/link";
import { requireActiveMembership } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import type { DatabaseWithPendingOnboarding } from "@/types/pending-database.types";

const metricCopy = { expected: "Registered, awaiting arrival", inside: "People currently on site", left: "People checked out" } as const;

export default async function AdminAccessPage() {
  const context = await requireActiveMembership(["admin"]);
  const supabase = await createClient<DatabaseWithPendingOnboarding>();
  const { data: metrics, error } = await supabase.rpc("get_admin_visit_metrics");
  if (error) throw new Error("Unable to load dashboard metrics.");
  const counts = { expected: 0, inside: 0, left: 0 };
  metrics.forEach((metric) => { counts[metric.visit_status] = metric.people_count; });

  return <main className="content-shell"><section className="card overflow-hidden"><div className="relative"><p className="eyebrow">Administrator overview</p><h1 className="title">Good to see you</h1><p className="copy">A live view of visitor activity at {context.organization.name}.</p></div><div className="mt-7 grid gap-4 sm:grid-cols-3">{Object.entries(counts).map(([status, count]) => <div className="metric-card" key={status}><div className="flex items-center justify-between gap-3"><p className="text-sm font-bold capitalize text-slate-700">{status}</p><span className={`status-badge status-${status}`}>{status}</span></div><p className="mt-4 text-4xl font-black tracking-tight text-slate-950">{count}</p><p className="mt-1 text-sm text-slate-500">{metricCopy[status as keyof typeof metricCopy]}</p></div>)}</div></section><section className="mt-6"><div className="mb-4"><h2 className="section-heading">Manage your organization</h2><p className="mt-1 text-sm text-slate-500">Visitor records, accountability and access controls.</p></div><nav className="grid gap-4 sm:grid-cols-2"><Link className="card group transition hover:-translate-y-0.5 hover:border-emerald-300" href="/app/admin/visits"><p className="eyebrow">Operations</p><h3 className="mt-2 text-xl font-bold group-hover:text-emerald-800">Visitor inventory →</h3><p className="mt-2 text-sm leading-6 text-slate-500">Search Expected, Inside and Left visits.</p></Link><Link className="card group transition hover:-translate-y-0.5 hover:border-emerald-300" href="/app/admin/reports"><p className="eyebrow">Reporting</p><h3 className="mt-2 text-xl font-bold group-hover:text-emerald-800">Print reports →</h3><p className="mt-2 text-sm leading-6 text-slate-500">Filter and print visitor records.</p></Link><Link className="card group transition hover:-translate-y-0.5 hover:border-emerald-300" href="/app/admin/audit"><p className="eyebrow">Accountability</p><h3 className="mt-2 text-xl font-bold group-hover:text-emerald-800">Audit history →</h3><p className="mt-2 text-sm leading-6 text-slate-500">Review important recorded actions.</p></Link><Link className="card group transition hover:-translate-y-0.5 hover:border-emerald-300" href="/app/admin/invitations"><p className="eyebrow">Access</p><h3 className="mt-2 text-xl font-bold group-hover:text-emerald-800">Members and invitations →</h3><p className="mt-2 text-sm leading-6 text-slate-500">Control authorized organization users.</p></Link></nav></section></main>;
}
