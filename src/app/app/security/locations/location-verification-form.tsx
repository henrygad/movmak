"use client";

import { useActionState, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { verifyHostLocation, type LocationVerificationState } from "../actions";

const initial: LocationVerificationState = { error: null, message: null };

export function LocationVerificationForm({ targetId, targetType, address, occupancyType }: { targetId: string; targetType: string; address: string | null; occupancyType: string | null }) {
  const [state, action, pending] = useActionState(verifyHostLocation, initial);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const confirmed = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

  return <>
    <form ref={formRef} action={action} className="mt-5 grid gap-4" onSubmit={(event) => {
      if (confirmed.current) { confirmed.current = false; return; }
      event.preventDefault();
      if (!formRef.current?.reportValidity()) return;
      setConfirmOpen(true);
    }}>
      <input type="hidden" name="targetId" value={targetId} />
      <input type="hidden" name="targetType" value={targetType} />
      <label className="text-sm font-semibold">Occupancy
        <select className="field font-normal" name="occupancyType" defaultValue={occupancyType ?? ""} required>
          <option value="" disabled>Select one</option><option value="landlord">Landlord / homeowner</option><option value="tenant">Tenant</option>
        </select>
      </label>
      <label className="text-sm font-semibold">Verified house or unit address<textarea className="field min-h-24 resize-y font-normal" name="address" defaultValue={address ?? ""} minLength={5} maxLength={300} required /></label>
      {state.error ? <p className="alert-error" role="alert">{state.error}</p> : null}
      {state.message ? <p className="alert-success" role="status">{state.message}</p> : null}
      <button className="button-primary justify-self-start" disabled={pending}>{pending ? "Verifying…" : "Location Verify"}</button>
    </form>
    <ConfirmDialog
      open={confirmOpen}
      title="Confirm this location in person"
      description="Only continue after you have physically confirmed the host's house or unit and landlord or tenant status. Your name and time will be recorded."
      confirmLabel="Confirm location"
      onClose={() => setConfirmOpen(false)}
      onConfirm={() => {
        setConfirmOpen(false);
        confirmed.current = true;
        formRef.current?.requestSubmit();
      }}
    />
  </>;
}
