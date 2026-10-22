"use client";

import { useActionState } from "react";
import { reviewMembershipRequest, type MemberActionState } from "./actions";
import type { OrganizationRole } from "@/lib/auth/access";

const initial: MemberActionState = { error: null, message: null };

export function RequestReviewForm({ id, role }: { id: string; role: OrganizationRole }) {
  const [state, action, pending] = useActionState(reviewMembershipRequest, initial);
  return <form action={action} className="flex flex-wrap items-end gap-2"><input type="hidden" name="requestId" value={id} /><input type="hidden" name="role" value={role} /><p className="mr-2 text-sm font-semibold capitalize">Assigned role: {role === "host" ? "Resident, worker or host" : role === "security" ? "Security or reception" : "Administrator"}</p><button className="button-primary" name="decision" value="approve" disabled={pending}>Approve</button><button className="button-secondary" name="decision" value="reject" disabled={pending}>Reject</button>{state.error ? <p className="w-full text-xs text-red-800" role="alert">{state.error}</p> : null}{state.message ? <p className="w-full text-xs text-emerald-800" role="status">{state.message}</p> : null}</form>;
}
