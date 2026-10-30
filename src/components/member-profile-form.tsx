"use client";

import { useActionState, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { updateMemberProfile, type MemberProfileState } from "@/app/app/member-profile-actions";

const initial: MemberProfileState = { error: null, message: null };

type MemberProfileFormProps = {
  role: "host" | "security";
  email: string;
  fullName: string | null;
  phone: string | null;
  address?: string | null;
  occupancyType?: string | null;
};

export function MemberProfileForm({ role, email, fullName, phone, address, occupancyType }: MemberProfileFormProps) {
  const [state, action, pending] = useActionState(updateMemberProfile, initial);
  const isHost = role === "host";
  const [confirmOpen, setConfirmOpen] = useState(false);
  const confirmed = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  return <><form ref={formRef} action={action} className="card mt-6" encType="multipart/form-data" onSubmit={(event) => {
    if (confirmed.current) { confirmed.current = false; return; }
    event.preventDefault();
    if (!formRef.current?.reportValidity()) return;
    setConfirmOpen(true);
  }}>
    <p className="eyebrow">Your profile</p>
    <h2 className="section-heading mt-2">Required details</h2>
    <p className="copy">{isHost ? "Security will confirm your location before an administrator can approve your account." : "Your name and phone number are required before approval."}</p>
    {state.error ? <p className="alert-error mt-5" role="alert">{state.error}</p> : null}
    {state.message ? <p className="alert-success mt-5" role="status">{state.message}</p> : null}
    <div className="mt-5 grid gap-4 sm:grid-cols-2">
      <label className="text-sm font-semibold">Full name<input className="field font-normal" name="fullName" defaultValue={fullName ?? ""} minLength={2} maxLength={160} autoComplete="name" required /></label>
      <label className="text-sm font-semibold">Email<input className="field font-normal" value={email} readOnly disabled /></label>
      <label className="text-sm font-semibold">Phone number<input className="field font-normal" name="phone" defaultValue={phone ?? ""} minLength={3} maxLength={40} inputMode="tel" autoComplete="tel" required /></label>
      {isHost ? <>
        <label className="text-sm font-semibold">Occupancy
          <select className="field font-normal" name="occupancyType" defaultValue={occupancyType ?? ""} required>
            <option value="" disabled>Select one</option><option value="landlord">Landlord / homeowner</option><option value="tenant">Tenant</option>
          </select>
        </label>
        <label className="text-sm font-semibold sm:col-span-2">Full house or unit address<textarea className="field min-h-24 resize-y font-normal" name="address" defaultValue={address ?? ""} minLength={5} maxLength={300} autoComplete="street-address" required /></label>
      </> : <label className="text-sm font-semibold">Profile photo <span className="font-normal text-slate-500">(optional)</span><input className="field font-normal" name="profilePhoto" type="file" accept="image/png,image/jpeg,image/webp" /><span className="mt-2 block text-xs font-normal text-slate-500">PNG, JPEG, or WebP under 2 MB.</span></label>}
    </div>
    <button className="button-primary mt-6" disabled={pending}>{pending ? "Saving…" : "Save profile"}</button>
  </form><ConfirmDialog
    open={confirmOpen}
    title="Save these profile details?"
    description={isHost ? "Changing your address or occupancy requires a new in-person security verification before invitation access continues." : "Your updated name, phone number, and optional photo will be shown to authorized organization users."}
    confirmLabel="Save profile"
    onClose={() => setConfirmOpen(false)}
    onConfirm={() => { setConfirmOpen(false); confirmed.current = true; formRef.current?.requestSubmit(); }}
  /></>;
}
