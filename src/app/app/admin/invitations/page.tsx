import Link from "next/link";
import { requireActiveMembership } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import type { DatabaseWithPendingOnboarding } from "@/types/pending-database.types";
import { MemberForm } from "./member-form";
import { JoinLinkActions, JoinLinkForm } from "./join-link-form";
import { RequestReviewForm } from "./request-review-form";

export default async function InvitationsPage() {
  const context = await requireActiveMembership(["admin"]);
  const supabase = await createClient<DatabaseWithPendingOnboarding>();
  const [{ data: memberships, error: memberError }, { data: access, error: accessError }] = await Promise.all([
    supabase.from("organization_memberships").select("id, user_id, role, status, created_at").eq("organization_id", context.organization.id).order("created_at"),
    supabase.rpc("list_organization_join_access"),
  ]);
  if (memberError || accessError) throw new Error("Unable to load organization access.");
  const userIds = memberships.map((member) => member.user_id);
  const { data: profiles, error: profileError } = userIds.length ? await supabase.from("user_profiles").select("user_id, full_name").in("user_id", userIds) : { data: [], error: null };
  if (profileError) throw new Error("Unable to load organization users.");
  const names = new Map(profiles.map((profile) => [profile.user_id, profile.full_name]));
  const links = access.filter((record) => record.record_type === "link");
  const requests = access.filter((record) => record.record_type === "request" && record.status === "pending");

  return <main className="content-shell"><section className="card"><p className="eyebrow">Authorized access</p><h1 className="title">Members and join links</h1><p className="copy">Share a reusable secure link. New users request access and remain blocked until an administrator approves them.</p><JoinLinkForm /></section><section className="card mt-6"><h2 className="section-heading">Active join links</h2><div className="mt-5 grid gap-3">{links.map((link) => <article className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center" key={link.record_id}><div><p className="font-semibold capitalize">{link.role} access</p><p className="mt-1 text-sm text-slate-500"><span className={`status-badge status-${link.status}`}>{link.status}</span>{link.expires_at ? ` · Expires ${new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: context.organization.timezone }).format(new Date(link.expires_at))}` : ""}</p></div>{link.status === "active" ? <JoinLinkActions id={link.record_id} /> : null}</article>)}{!links.length ? <p className="text-slate-600">No join links have been created.</p> : null}</div></section><section className="card mt-6"><h2 className="section-heading">Pending members</h2><p className="copy">Review every request before organization access is granted.</p><div className="mt-5 grid gap-4">{requests.map((request) => <article className="rounded-xl border border-amber-200 bg-amber-50/50 p-4" key={request.record_id}><div className="mb-4"><p className="font-semibold">{request.display_name}</p><p className="mt-1 text-sm text-slate-600">Requested <span className="font-semibold capitalize">{request.role}</span> · {request.email_verified ? "Email verified" : "Email not verified"} · {new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: context.organization.timezone }).format(new Date(request.created_at))}</p></div><RequestReviewForm id={request.record_id} role={request.role} /></article>)}{!requests.length ? <p className="text-slate-600">No membership requests are waiting for review.</p> : null}</div></section><section className="card mt-6"><h2 className="section-heading">Organization members</h2><div className="mt-5 grid gap-4">{memberships.map((member) => <article className="rounded-xl border border-slate-200 p-4" key={member.id}><div className="mb-4"><p className="font-semibold">{names.get(member.user_id) ?? "Organization user"}</p><p className="text-sm capitalize text-slate-500">{member.role} &middot; {member.status}</p></div><MemberForm id={member.id} role={member.role} status={member.status} disabled={member.user_id === context.user.id} /></article>)}</div><p className="mt-6"><Link className="link-button" href="/app/admin">Back to administrator dashboard</Link></p></section></main>;
}
