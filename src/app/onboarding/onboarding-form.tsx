"use client";

import { useActionState } from "react";
import { createOrganization, type OnboardingState } from "./actions";

const initialState: OnboardingState = { error: null };

export function OnboardingForm() {
  const [state, action, pending] = useActionState(createOrganization, initialState);
  return (
    <form action={action} className="mt-8 space-y-5">
      <div>
        <label className="text-sm font-medium text-slate-800" htmlFor="name">Organization name</label>
        <input className="field" id="name" name="name" minLength={2} maxLength={160} required />
      </div>
      <div>
        <label className="text-sm font-medium text-slate-800" htmlFor="slug">Organization URL name</label>
        <input className="field" id="slug" name="slug" minLength={2} maxLength={100} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="example-company" required />
        <p className="mt-2 text-xs text-slate-500">Lowercase letters, numbers, and hyphens only.</p>
      </div>
      {state.error ? <p className="alert-error" role="alert">{state.error}</p> : null}
      <button className="button-primary w-full" disabled={pending} type="submit">
        {pending ? "Creating organization…" : "Create organization"}
      </button>
    </form>
  );
}
