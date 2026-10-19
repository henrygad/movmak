import { loadAdminVisits } from "@/lib/admin/visits";
import { PrintButton } from "./print-button";

type Params = { status?: string; from?: string; to?: string };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const filters = await searchParams;
  const { context, visits } = await loadAdminVisits(filters);
  const people = visits.reduce((total, visit) => total + visit.group_size, 0);
  const format = (value: string | null) => value
    ? new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: context.organization.timezone }).format(new Date(value))
    : "—";

  return (
    <main className="content-shell print:max-w-none print:p-0">
      <section className="card print:border-0 print:p-0 print:shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div><p className="eyebrow">Printable visitor report</p><h1 className="title">{context.organization.name}</h1><p className="copy">{visits.length} visits · {people} people · Generated {format(new Date().toISOString())}</p></div>
          <PrintButton />
        </div>
        <form className="mt-6 grid gap-4 sm:grid-cols-4 print:hidden">
          <label className="text-sm font-semibold">Status<select className="field font-normal" name="status" defaultValue={filters.status ?? ""}><option value="">All</option><option value="expected">Expected</option><option value="inside">Inside</option><option value="left">Left</option></select></label>
          <label className="text-sm font-semibold">From<input className="field font-normal" type="date" name="from" defaultValue={filters.from} /></label>
          <label className="text-sm font-semibold">To<input className="field font-normal" type="date" name="to" defaultValue={filters.to} /></label>
          <button className="button-secondary self-end">Update</button>
        </form>
        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-4xl text-left text-xs">
            <thead><tr className="border-b-2 border-slate-900"><th className="p-2">Visit</th><th className="p-2">Visitor / phone</th><th className="p-2">Host</th><th className="p-2">Purpose</th><th className="p-2">People</th><th className="p-2">Status</th><th className="p-2">In</th><th className="p-2">Out</th></tr></thead>
            <tbody>{visits.map((visit) => <tr className="border-b border-slate-300" key={visit.id}><td className="p-2">{visit.visit_reference}</td><td className="p-2">{visit.visitorName}<br />{visit.visitorPhone ?? "N/A"}</td><td className="p-2">{visit.hostName}</td><td className="p-2">{visit.purpose}</td><td className="p-2">{visit.group_size}</td><td className="p-2 uppercase">{visit.status}</td><td className="p-2">{format(visit.checked_in_at)}</td><td className="p-2">{format(visit.checked_out_at)}</td></tr>)}</tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
