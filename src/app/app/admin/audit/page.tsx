import Link from "next/link";
import { requireActiveMembership } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

type Params = { action?: string; from?: string; to?: string };

export default async function AuditPage({ searchParams }: { searchParams: Promise<Params> }) {
  const filters = await searchParams;
  const context = await requireActiveMembership(["admin"]);
  const supabase = await createClient();
  let request = supabase.from("audit_events").select("id, action, actor_type, actor_user_id, target_table, target_id, occurred_at").eq("organization_id", context.organization.id).order("occurred_at", { ascending: false }).limit(250);
  if (filters.action?.trim()) request = request.ilike("action", `%${filters.action.trim().replaceAll("%", "\\%").replaceAll("_", "\\_")}%`);
  if (filters.from && /^\d{4}-\d{2}-\d{2}$/.test(filters.from)) request = request.gte("occurred_at", `${filters.from}T00:00:00.000Z`);
  if (filters.to && /^\d{4}-\d{2}-\d{2}$/.test(filters.to)) request = request.lte("occurred_at", `${filters.to}T23:59:59.999Z`);
  const { data: events, error } = await request;
  if (error) throw new Error("Unable to load audit history.");
  const actorIds = [...new Set(events.flatMap((event) => event.actor_user_id ? [event.actor_user_id] : []))];
  const { data: profiles, error: profileError } = actorIds.length ? await supabase.from("user_profiles").select("user_id, full_name").in("user_id", actorIds) : { data: [], error: null };
  if (profileError) throw new Error("Unable to load audit actors.");
  const names = new Map(profiles.map((profile) => [profile.user_id, profile.full_name]));
  const format = (value: string) => new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "medium", timeZone: context.organization.timezone }).format(new Date(value));

  return <main className="content-shell"><section className="card"><p className="eyebrow">Accountability</p><h1 className="title">Audit history</h1><p className="copy">Recent important actions for {context.organization.name}. Audit records cannot be edited or deleted by organization users.</p><form className="mt-6 grid gap-4 sm:grid-cols-4"><label className="text-sm font-semibold sm:col-span-2">Action contains<input className="field font-normal" name="action" defaultValue={filters.action} placeholder="visit, membership, invitation" /></label><label className="text-sm font-semibold">From<input className="field font-normal" type="date" name="from" defaultValue={filters.from} /></label><label className="text-sm font-semibold">To<input className="field font-normal" type="date" name="to" defaultValue={filters.to} /></label><button className="button-primary">Apply filters</button><Link className="button-secondary text-center" href="/app/admin/audit">Clear</Link></form></section><section className="mt-6 grid gap-3">{events.map((event) => <article className="rounded-xl border border-slate-200 bg-white p-5" key={event.id}><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold text-slate-950">{event.action.replaceAll(".", " ")}</h2><p className="mt-1 text-sm text-slate-600">{event.target_table}{event.target_id ? ` · ${event.target_id}` : ""}</p></div><time className="text-sm text-slate-500" dateTime={event.occurred_at}>{format(event.occurred_at)}</time></div><p className="mt-3 text-sm text-slate-600">Actor: {event.actor_user_id ? names.get(event.actor_user_id) ?? "Authorized user" : event.actor_type.replaceAll("_", " ")}</p></article>)}{!events.length ? <div className="card"><p className="text-slate-600">No audit events match these filters.</p></div> : null}</section></main>;
}
