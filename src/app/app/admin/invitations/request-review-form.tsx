"use client";

import { useActionState, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import type { OrganizationRole } from "@/lib/auth/access";
import { reviewMembershipRequest, type MemberActionState } from "./actions";

const initial: MemberActionState = { error: null, message: null };

type ReviewDecision = "approve" | "reject";

type RequestReviewFormProps = {
  id: string;
  role: OrganizationRole;
  approvalDisabled?: boolean;
  approvalDisabledReason?: string;
};

export function RequestReviewForm({
  id,
  role,
  approvalDisabled = false,
  approvalDisabledReason,
}: RequestReviewFormProps) {
  const [state, action, pending] = useActionState(reviewMembershipRequest, initial);
  const [decision, setDecision] = useState<ReviewDecision | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const decisionRef = useRef<HTMLInputElement>(null);
  const roleLabel = role === "host"
    ? "resident, worker or host"
    : role === "security"
      ? "security or reception"
      : "administrator";

  function submitDecision() {
    if (!decision || !decisionRef.current || !formRef.current) return;
    decisionRef.current.value = decision;
    setDecision(null);
    formRef.current.requestSubmit();
  }

  return (
    <>
      <form ref={formRef} action={action} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="requestId" value={id} />
        <input type="hidden" name="role" value={role} />
        <input ref={decisionRef} type="hidden" name="decision" />
        <p className="mr-2 text-sm font-semibold capitalize">Assigned role: {roleLabel}</p>
        <button
          className="button-primary"
          type="button"
          disabled={pending || approvalDisabled}
          title={approvalDisabled ? approvalDisabledReason : undefined}
          onClick={() => setDecision("approve")}
        >
          {pending ? "Updating..." : "Approve"}
        </button>
        <button
          className="button-secondary"
          type="button"
          disabled={pending}
          onClick={() => setDecision("reject")}
        >
          Reject
        </button>
        {approvalDisabled && approvalDisabledReason ? (
          <p className="w-full text-xs font-medium text-amber-800" role="status">{approvalDisabledReason}</p>
        ) : null}
        {state.error ? <p className="w-full text-xs text-red-800" role="alert">{state.error}</p> : null}
        {state.message ? <p className="w-full text-xs text-emerald-800" role="status">{state.message}</p> : null}
      </form>
      <ConfirmDialog
        open={decision !== null}
        title={decision === "approve" ? "Approve this member?" : "Reject this request?"}
        description={decision === "approve"
          ? `This person will receive active ${roleLabel} access to the organization.`
          : "This request will be rejected and will not grant organization access."}
        confirmLabel={decision === "approve" ? "Approve member" : "Reject request"}
        dangerous={decision === "reject"}
        onClose={() => setDecision(null)}
        onConfirm={submitDecision}
      />
    </>
  );
}
