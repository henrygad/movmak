"use client";

import { useActionState } from "react";
import { updateVisitCompanions } from "./actions";

export function CompanionCountForm({ visitId, groupSize }: { visitId: string; groupSize: number }) {
  const [state, action, pending] = useActionState(updateVisitCompanions, { error: null, message: null });
  return <form action={action} className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
    <input type="hidden" name="visitId" value={visitId} />
    <label className="text-sm font-semibold text-slate-800">Companions at the gate
      <span className="mt-1 block text-xs font-normal text-slate-500">The primary visitor is counted separately.</span>
      <input className="field max-w-32 font-normal" name="companionCount" type="number" min={0} max={99} defaultValue={Math.max(0, groupSize - 1)} required />
    </label>
    <button className="button-secondary mt-3" disabled={pending}>{pending ? "Updating…" : "Update companions"}</button>
    {state.error ? <p className="mt-3 text-sm text-red-800" role="alert">{state.error}</p> : null}
    {state.message ? <p className="mt-3 text-sm text-emerald-800" role="status">{state.message}</p> : null}
  </form>;
}
