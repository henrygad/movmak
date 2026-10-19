"use client";

import { useActionState } from "react";
import { createInvitation, type InvitationState } from "./actions";

const initialState: InvitationState = { error: null, invitationPath: null };

export function InvitationForm() {
  const [state, action, pending] = useActionState(createInvitation, initialState);
  return <form action={action} className="mt-8 space-y-5">
    <div><label className="text-sm font-medium text-slate-800" htmlFor="email">Invited person’s verified email</label><input className="field" id="email" name="email" type="email" maxLength={320} required /></div>
    <div><label className="text-sm font-medium text-slate-800" htmlFor="role">Organization role</label><select className="field" id="role" name="role" defaultValue="host"><option value="host">Resident or worker</option><option value="security">Security or reception</option><option value="admin">Administrator</option></select></div>
    <p className="text-sm text-slate-600">The link expires after 48 hours and works only for this email address. Share it privately.</p>
    {state.error ? <p className="alert-error" role="alert">{state.error}</p> : null}
    {state.invitationPath ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4" role="status"><p className="font-semibold text-emerald-950">Invitation created</p><p className="mt-2 break-all text-sm text-emerald-900">{state.invitationPath}</p><p className="mt-2 text-xs text-emerald-800">This credential is shown once. Copy it now.</p></div> : null}
    <button className="button-primary w-full" disabled={pending} type="submit">{pending ? "Creating invitation…" : "Create invitation"}</button>
  </form>;
}
