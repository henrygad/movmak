"use client";

import { useActionState } from "react";
import { updateMembership, type MemberActionState } from "./actions";
import type { MembershipStatus, OrganizationRole } from "@/lib/auth/access";

const initial: MemberActionState = { error: null, message: null };

export function MemberForm({ id, role, status, disabled }: { id: string; role: OrganizationRole; status: MembershipStatus; disabled: boolean }) {
  const [state, action, pending] = useActionState(updateMembership, initial);
  return <form action={action} className="flex flex-wrap items-end gap-3"><input type="hidden" name="membershipId" value={id} /><input type="hidden" name="role" value={role} /><div><p className="text-xs font-semibold">Role</p><p className="mt-2 rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold capitalize text-slate-700">{role}</p></div><label className="text-xs font-semibold">Status<select className="field mt-1 min-w-36" name="status" defaultValue={status} disabled={disabled}><option value="active">Active</option><option value="suspended">Suspended</option><option value="revoked">Revoked</option></select></label><button className="button-secondary" disabled={disabled || pending}>{pending ? "Saving…" : "Save status"}</button>{disabled ? <p className="w-full text-xs text-slate-500">You cannot change your own membership.</p> : <p className="w-full text-xs text-slate-500">Roles are permanent. Create another account if a person needs a different role.</p>}{state.error ? <p className="w-full text-sm text-red-800" role="alert">{state.error}</p> : null}{state.message ? <p className="w-full text-sm text-emerald-800" role="status">{state.message}</p> : null}</form>;
}
