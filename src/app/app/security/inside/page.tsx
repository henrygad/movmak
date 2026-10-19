import Link from "next/link";
import { requireActiveMembership } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import type { DatabaseWithPendingOnboarding } from "@/types/pending-database.types";
import { CheckoutButton } from "./checkout-button";

export default async function CurrentlyInsidePage({ searchParams }: { searchParams: Promise<{ query?: string }> }) {
  const params = await searchParams;
  const context = await requireActiveMembership(["security"]);
  const supabase = await createClient<DatabaseWithPendingOnboarding>();
  const { data: visits, error } = await supabase.rpc("get_currently_inside");
  if (error) throw new Error("Unable to load the current visitor list.");

  const query = params.query?.trim().toLowerCase() ?? "";
  const filtered = (visits ?? []).filter((visit) => !query ||
    [visit.visit_reference, visit.visitor_name, visit.host_name, visit.purpose]
      .some((value) => value.toLowerCase().includes(query)));
  const headcount = visits?.reduce((sum, visit) => sum + visit.group_size, 0) ?? 0;

  return (
    <main className="content-shell">
      <div className="mb-3 text-sm text-slate-500"><Link className="hover:text-slate-900" href="/app/security">Gate desk</Link><span className="mx-2">/</span><span>Currently inside</span></div>
      <section className="card">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div><p className="eyebrow">Live occupancy</p><h1 className="title">{headcount} {headcount === 1 ? "person" : "people"} inside</h1><p className="copy">{visits?.length ?? 0} active {visits?.length === 1 ? "visit" : "visits"}. Group totals include unnamed companions.</p></div>
          <Link className="button-primary shrink-0" href="/app/security/new">Register visitor</Link>
        </div>
        <form className="mt-7 flex flex-col gap-3 sm:flex-row">
          <label className="sr-only" htmlFor="inside-search">Search currently inside</label>
          <input className="field mt-0" id="inside-search" name="query" defaultValue={params.query} placeholder="Search visitor, host, purpose or Visit ID" />
          <button className="button-secondary shrink-0">Search</button>
          {query ? <Link className="button-ghost shrink-0" href="/app/security/inside">Clear</Link> : null}
        </form>
      </section>
      <section className="mt-6 grid gap-4">
        {filtered.length ? filtered.map((visit) => (
          <article className="card" key={visit.visit_id}><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="status-badge status-inside">Inside</span><p className="text-sm font-bold text-slate-500">{visit.visit_reference}</p></div><h2 className="mt-3 text-xl font-bold text-slate-950">{visit.visitor_name}</h2><p className="mt-2 text-slate-600">Visiting <strong>{visit.host_name}</strong> &middot; {visit.purpose}</p><div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-500"><span><strong className="text-slate-800">{visit.group_size}</strong> {visit.group_size === 1 ? "person" : "people"}</span><span>Checked in {new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: context.organization.timezone }).format(new Date(visit.checked_in_at))}</span></div></div>
            <CheckoutButton visitId={visit.visit_id} />
          </div></article>
        )) : (
          <div className="card text-center"><div className="mx-auto flex size-12 items-center justify-center rounded-full bg-slate-100 text-xl" aria-hidden="true">&#10003;</div><h2 className="mt-4 text-xl font-bold">{query ? "No matching visitors" : "No visitors are currently inside"}</h2><p className="copy mx-auto">{query ? "Try another name, host, purpose, or Visit ID." : "Checked-in visits will appear here."}</p></div>
        )}
      </section>
    </main>
  );
}
