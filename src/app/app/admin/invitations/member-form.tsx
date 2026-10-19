"use client";

import { useActionState } from "react";
import { updateMembership, type MemberActionState } from "./actions";
import type { MembershipStatus, OrganizationRole } from "@/lib/auth/access";

const initial: MemberActionState = { error: null, message: null };

export function MemberForm({ id, role, status, disabled }: { id: string; role: OrganizationRole; status: MembershipStatus; disabled: boolean }) {
  const [state, action, pending] = useActionState(updateMembership, initial);
  return <form action={action} className="flex flex-wrap items-end gap-3"><input type="hidden" name="membershipId" value={id} /><label className="text-xs font-semibold">Role<select className="field mt-1 min-w-40" name="role" defaultValue={role} disabled={disabled}><option value="host">Resident or worker</option><option value="security">Security or reception</option><option value="admin">Administrator</option></select></label><label className="text-xs font-semibold">Status<select className="field mt-1 min-w-36" name="status" defaultValue={status} disabled={disabled}><option value="active">Active</option><option value="suspended">Suspended</option><option value="revoked">Revoked</option></select></label><button className="button-secondary" disabled={disabled || pending}>{pending ? "Saving…" : "Save"}</button>{disabled ? <p className="w-full text-xs text-slate-500">You cannot change your own membership.</p> : null}{state.error ? <p className="w-full text-sm text-red-800" role="alert">{state.error}</p> : null}{state.message ? <p className="w-full text-sm text-emerald-800" role="status">{state.message}</p> : null}</form>;
}
