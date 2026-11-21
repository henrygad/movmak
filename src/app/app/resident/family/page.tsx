import { requireActiveMembership } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import type { DatabaseWithPendingOnboarding } from "@/types/pending-database.types";
import { FamilyInvitationForm } from "./invitation-form";
import { revokeFamilyInvitation } from "./actions";

export default async function FamilyMembersPage() {
  await requireActiveMembership(["host"]);
  const supabase = await createClient<DatabaseWithPendingOnboarding>();
  const { data: invitations, error } = await supabase.rpc("list_my_family_invitations");
  if (error) throw new Error("Family invitations could not be loaded.");
  return <main className="content-shell"><section className="card"><p className="eyebrow">Resident household</p><h1 className="title">Family members</h1><p className="copy">Invite, review, and revoke access for people in your verified household.</p></section><FamilyInvitationForm /><section className="card mt-6"><h2 className="section-heading">Invitations</h2><div className="mt-5 grid gap-3">{invitations.map((item) => <div className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center" key={item.invitation_id}><div><p className="font-bold">{item.full_name}</p><p className="text-sm text-slate-600">{item.email} · <span className="capitalize">{item.status}</span></p></div>{["created", "requested", "sent", "failed"].includes(item.status) ? <form action={revokeFamilyInvitation}><input type="hidden" name="invitationId" value={item.invitation_id} /><button className="button-secondary">Revoke</button></form> : null}</div>)}{!invitations.length ? <p className="text-sm text-slate-600">No family invitations yet.</p> : null}</div></section></main>;
}
