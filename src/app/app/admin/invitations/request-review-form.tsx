"use client";

import { useActionState } from "react";
import { reviewMembershipRequest, type MemberActionState } from "./actions";
import type { OrganizationRole } from "@/lib/auth/access";

const initial: MemberActionState = { error: null, message: null };

export function RequestReviewForm({ id, role }: { id: string; role: OrganizationRole }) {
  const [state, action, pending] = useActionState(reviewMembershipRequest, initial);
  return <form action={action} className="flex flex-wrap items-end gap-2"><input type="hidden" name="requestId" value={id} /><label className="text-xs font-semibold">Assign role<select className="field mt-1" name="role" defaultValue={role}><option value="host">Resident or worker</option><option value="security">Security or reception</option><option value="admin">Administrator</option></select></label><button className="button-primary" name="decision" value="approve" disabled={pending}>Approve</button><button className="button-secondary" name="decision" value="reject" disabled={pending}>Reject</button>{state.error ? <p className="w-full text-xs text-red-800" role="alert">{state.error}</p> : null}{state.message ? <p className="w-full text-xs text-emerald-800" role="status">{state.message}</p> : null}</form>;
}
