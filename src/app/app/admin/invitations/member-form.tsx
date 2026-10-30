"use client";

import { useActionState, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import type { MembershipStatus, OrganizationRole } from "@/lib/auth/access";
import { updateMembership, type MemberActionState } from "./actions";

const initial: MemberActionState = { error: null, message: null };

export function MemberForm({ id, role, status, disabled }: { id: string; role: OrganizationRole; status: MembershipStatus; disabled: boolean }) {
  const [state, action, pending] = useActionState(updateMembership, initial);
  const [selectedStatus, setSelectedStatus] = useState(status);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const confirmed = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

  return <>
    <form ref={formRef} action={action} className="flex flex-wrap items-end gap-3" onSubmit={(event) => {
      if (confirmed.current) { confirmed.current = false; return; }
      event.preventDefault();
      setConfirmOpen(true);
    }}>
      <input type="hidden" name="membershipId" value={id} />
      <input type="hidden" name="role" value={role} />
      <div><p className="text-xs font-semibold">Role</p><p className="mt-2 rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold capitalize text-slate-700">{role}</p></div>
      <label className="text-xs font-semibold">Status<select className="field mt-1 min-w-36" name="status" value={selectedStatus} onChange={(event) => setSelectedStatus(event.target.value as MembershipStatus)} disabled={disabled}><option value="active">Active</option><option value="suspended">Suspended</option><option value="revoked">Revoked</option></select></label>
      <button className="button-secondary" disabled={disabled || pending}>{pending ? "Saving…" : "Save status"}</button>
      {disabled ? <p className="w-full text-xs text-slate-500">You cannot change your own membership.</p> : <p className="w-full text-xs text-slate-500">Roles are permanent. Create another account if a person needs a different role.</p>}
      {state.error ? <p className="w-full text-sm text-red-800" role="alert">{state.error}</p> : null}
      {state.message ? <p className="w-full text-sm text-emerald-800" role="status">{state.message}</p> : null}
    </form>
    <ConfirmDialog
      open={confirmOpen}
      title={`Set this membership to ${selectedStatus}?`}
      description={selectedStatus === "active" ? "This member will regain the actions allowed by their permanent role." : "This member will immediately lose active organization access."}
      confirmLabel="Update membership"
      dangerous={selectedStatus !== "active"}
      onClose={() => setConfirmOpen(false)}
      onConfirm={() => { setConfirmOpen(false); confirmed.current = true; formRef.current?.requestSubmit(); }}
    />
  </>;
}
