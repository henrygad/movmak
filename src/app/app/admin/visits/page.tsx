import Link from "next/link";
import { loadAdminVisits } from "@/lib/admin/visits";
import { VisitorInventoryTable } from "./visitor-inventory-table";

type Params = { status?: string; query?: string; from?: string; to?: string };

export default async function AdminVisitsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const filters = await searchParams;
  const { context, visits } = await loadAdminVisits(filters);
  return <main className="content-shell"><section className="card"><p className="eyebrow">Visitor inventory</p><h1 className="title">Visit history</h1><p className="copy">Select a Visit ID to see the full visitor, host, timing, and group details.</p><form className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5"><label className="text-sm font-semibold lg:col-span-2">Search<input className="field font-normal" name="query" defaultValue={filters.query} placeholder="Visitor, host, purpose, Visit ID" /></label><label className="text-sm font-semibold">Status<select className="field font-normal" name="status" defaultValue={filters.status ?? ""}><option value="">All</option><option value="expected">Expected</option><option value="inside">Inside</option><option value="left">Left</option></select></label><label className="text-sm font-semibold">From<input className="field font-normal" type="date" name="from" defaultValue={filters.from} /></label><label className="text-sm font-semibold">To<input className="field font-normal" type="date" name="to" defaultValue={filters.to} /></label><button className="button-primary sm:col-span-2 lg:col-span-1">Apply filters</button><Link className="button-secondary text-center sm:col-span-2 lg:col-span-1" href="/app/admin/visits">Clear</Link></form></section><VisitorInventoryTable visits={visits} timezone={context.organization.timezone} /></main>;
}
