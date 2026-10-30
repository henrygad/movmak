import Link from "next/link";
import { requireActiveMembership } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";
import type { DatabaseWithPendingOnboarding } from "@/types/pending-database.types";

type VisitStatus = Database["public"]["Enums"]["visit_status"];

export default async function SecurityVisitsPage({ searchParams }: { searchParams: Promise<{ status?: string; query?: string }> }) {
  const filters = await searchParams;
  const context = await requireActiveMembership(["security"]);
  const supabase = await createClient<DatabaseWithPendingOnboarding>();
  const status = ["expected", "inside", "left"].includes(filters.status ?? "") ? filters.status as VisitStatus : undefined;
  const { data, error } = await supabase.rpc("list_security_visit_history", { p_status: status });
  if (error) throw new Error("Unable to load visit history.");
  const query = filters.query?.trim().toLocaleLowerCase("en-NG") ?? "";
  const visits = query
    ? data.filter((visit) => [visit.visit_reference, visit.visitor_name, visit.host_name, visit.purpose].some((value) => value.toLocaleLowerCase("en-NG").includes(query)))
    : data;
  const format = (value: string) => new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: context.organization.timezone }).format(new Date(value));

  return (
    <main className="content-shell">
      <section className="card">
        <p className="eyebrow">Gate records</p>
        <h1 className="title">Visit history</h1>
        <p className="copy">Expected, inside, and departed visitors recorded since your security account was created.</p>
        <form className="mt-6 grid gap-4 sm:grid-cols-[1fr_12rem_auto_auto]">
          <label className="text-sm font-semibold">Search<input className="field font-normal" name="query" defaultValue={filters.query} placeholder="Visitor, host, purpose, Visit ID" /></label>
          <label className="text-sm font-semibold">Status<select className="field font-normal" name="status" defaultValue={filters.status ?? ""}><option value="">All</option><option value="expected">Expected</option><option value="inside">Inside</option><option value="left">Left</option></select></label>
          <button className="button-primary self-end">Apply</button>
          <Link className="button-secondary self-end text-center" href="/app/security/visits">Clear</Link>
        </form>
      </section>
      <section className="mt-6 grid gap-4">
        {visits.map((visit) => (
          <Link className="card group transition hover:-translate-y-0.5 hover:border-emerald-300" href={`/app/security/visits/${visit.visit_id}`} key={visit.visit_id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h2 className="text-lg font-bold group-hover:text-emerald-800">{visit.visitor_name}</h2><p className="mt-1 text-sm text-slate-500">{visit.visit_reference} · Visiting {visit.host_name}</p></div>
              <span className={`status-badge status-${visit.visit_status}`}>{visit.visit_status}</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600"><span>{visit.purpose}</span><span>{Math.max(0, visit.group_size - 1)} companions</span><span>{format(visit.registered_at)}</span></div>
          </Link>
        ))}
        {!visits.length ? <div className="card text-center text-slate-600">No visits match these filters.</div> : null}
      </section>
    </main>
  );
}
