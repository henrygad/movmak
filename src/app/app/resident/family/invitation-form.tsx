"use client";

import { useActionState } from "react";
import { inviteFamilyMember, type FamilyInvitationState } from "./actions";

const initial: FamilyInvitationState = { error: null, message: null };

export function FamilyInvitationForm() {
  const [state, action, pending] = useActionState(inviteFamilyMember, initial);
  return <form action={action} className="card mt-6">
    <p className="eyebrow">Family members</p><h2 className="section-heading mt-2">Add a household member</h2>
    <p className="copy">They receive their own account and must verify both email and phone. Your verified household address is inherited.</p>
    <div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">Full name<input className="field font-normal" name="fullName" minLength={2} maxLength={160} required /></label><label className="text-sm font-semibold">Email address<input className="field font-normal" name="email" type="email" autoComplete="email" required /></label></div>
    {state.error ? <p className="alert-error mt-4" role="alert">{state.error}</p> : null}{state.message ? <p className="alert-success mt-4" role="status">{state.message}</p> : null}
    <button className="button-primary mt-5" disabled={pending}>{pending ? "Sending…" : "Send family invitation"}</button>
  </form>;
}
