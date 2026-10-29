"use client";

import { useActionState } from "react";
import { updateHostProfile } from "./profile-actions";

export function ProfileForm({ fullName, phone, address }: { fullName: string | null; phone: string | null; address: string | null }) {
  const [state, action, pending] = useActionState(updateHostProfile, { error: null, message: null });
  return <form action={action} className="card mt-6" aria-labelledby="host-profile-heading">
    <p className="eyebrow">Your profile</p><h2 id="host-profile-heading" className="section-heading mt-2">Contact details</h2>
    <p className="copy">Your phone and house or unit address help authorized administrators and security identify where a visitor is going. Visitors cannot see these details.</p>
    {!fullName || !phone || !address ? <p className="alert-error mt-5">Complete all profile details before inviting visitors.</p> : null}
    {state.error ? <p className="alert-error mt-5" role="alert">{state.error}</p> : null}
    {state.message ? <p className="alert-success mt-5" role="status">{state.message}</p> : null}
    <div className="mt-5 grid gap-4 sm:grid-cols-2">
      <label className="text-sm font-semibold text-slate-800">Display name<input className="field font-normal" name="fullName" defaultValue={fullName ?? ""} minLength={2} maxLength={160} autoComplete="name" required /></label>
      <label className="text-sm font-semibold text-slate-800">Phone number<input className="field font-normal" name="phone" defaultValue={phone ?? ""} minLength={3} maxLength={40} inputMode="tel" autoComplete="tel" required /></label>
      <label className="text-sm font-semibold text-slate-800 sm:col-span-2">House or unit address<textarea className="field min-h-24 resize-y font-normal" name="address" defaultValue={address ?? ""} minLength={5} maxLength={300} autoComplete="street-address" required /></label>
    </div>
    <button className="button-secondary mt-5" disabled={pending} type="submit">{pending ? "Saving…" : "Save profile"}</button>
  </form>;
}
