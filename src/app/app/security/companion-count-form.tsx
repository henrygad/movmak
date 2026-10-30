"use client";

import { useActionState, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { updateVisitCompanions } from "./actions";

export function CompanionCountForm({ visitId, groupSize }: { visitId: string; groupSize: number }) {
  const [state, action, pending] = useActionState(updateVisitCompanions, { error: null, message: null });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [companionCount, setCompanionCount] = useState(String(Math.max(0, groupSize - 1)));
  const confirmed = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

  return <>
    <form ref={formRef} action={action} className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4" onSubmit={(event) => {
      if (confirmed.current) {
        confirmed.current = false;
        return;
      }
      event.preventDefault();
      if (!formRef.current?.reportValidity()) return;
      setConfirmOpen(true);
    }}>
      <input type="hidden" name="visitId" value={visitId} />
      <label className="text-sm font-semibold text-slate-800">Companions at the gate
        <span className="mt-1 block text-xs font-normal text-slate-500">The primary visitor is counted separately.</span>
        <input className="field max-w-32 font-normal" name="companionCount" type="number" min={0} max={99} value={companionCount} onChange={(event) => setCompanionCount(event.target.value)} required />
      </label>
      <button className="button-secondary mt-3" disabled={pending}>{pending ? "Updating…" : "Update companions"}</button>
      {state.error ? <p className="mt-3 text-sm text-red-800" role="alert">{state.error}</p> : null}
      {state.message ? <p className="mt-3 text-sm text-emerald-800" role="status">{state.message}</p> : null}
    </form>
    <ConfirmDialog
      open={confirmOpen}
      title="Update the companion count?"
      description={`This visit will record ${companionCount || "0"} companions. The correction is added to the audit history.`}
      confirmLabel="Update companions"
      onClose={() => setConfirmOpen(false)}
      onConfirm={() => {
        setConfirmOpen(false);
        confirmed.current = true;
        formRef.current?.requestSubmit();
      }}
    />
  </>;
}
