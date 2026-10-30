type VisitDetailRecord = {
  checked_in_at: string | null;
  checked_in_by_name: string | null;
  checked_out_at: string | null;
  checked_out_by_name: string | null;
  entry_method: string;
  group_size: number;
  host_address: string | null;
  host_name: string;
  host_occupancy_type: string | null;
  host_phone: string | null;
  purpose: string;
  registered_at: string;
  visit_reference: string;
  visit_status: string;
  visitor_name: string;
  visitor_phone: string | null;
};

export function VisitDetail({ visit, timezone }: { visit: VisitDetailRecord; timezone: string }) {
  const format = (value: string | null) => value
    ? new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: timezone }).format(new Date(value))
    : "Not recorded";

  return (
    <section className="card mt-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Visit details</p>
          <h1 className="title mt-2">{visit.visitor_name}</h1>
          <p className="mt-1 font-mono text-sm text-slate-500">{visit.visit_reference}</p>
        </div>
        <span className={`status-badge status-${visit.visit_status}`}>{visit.visit_status}</span>
      </div>
      <dl className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <Detail label="Visitor phone" value={visit.visitor_phone ?? "Not provided"} />
        <Detail label="Purpose" value={visit.purpose} />
        <Detail label="Companions" value={`${Math.max(0, visit.group_size - 1)} (${visit.group_size} total people)`} />
        <Detail label="Host" value={visit.host_name} />
        <Detail label="Host phone" value={visit.host_phone ?? "Not provided"} />
        <Detail label="Host house or unit" value={visit.host_address ?? "Not provided"} />
        <Detail label="Host occupancy" value={visit.host_occupancy_type ?? "Not provided"} />
        <Detail label="Entry method" value={visit.entry_method.replaceAll("_", " ")} />
        <Detail label="Registered" value={format(visit.registered_at)} />
        <Detail label="Checked in" value={format(visit.checked_in_at)} />
        <Detail label="Checked in by" value={visit.checked_in_by_name ?? "Not recorded"} />
        <Detail label="Checked out" value={format(visit.checked_out_at)} />
        <Detail label="Checked out by" value={visit.checked_out_by_name ?? "Not recorded"} />
      </dl>
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 break-words capitalize text-slate-900">{value}</dd></div>;
}
