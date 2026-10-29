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
        <label className="text-sm font-medium text-slate-800" htmlFor="website">Organization URL</label>
        <input
          aria-describedby="website-help"
          autoCapitalize="none"
          autoComplete="url"
          autoCorrect="off"
          className="field"
          id="website"
          inputMode="url"
          maxLength={2048}
          name="website"
          pattern="(?:https?://)?(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+(?:[A-Za-z]{2,63}|xn--[A-Za-z0-9-]{2,59})(?:[/][^ ]*)?"
          placeholder="example.com"
          spellCheck={false}
          title="Enter a website such as example.com or www.example.com"
          type="text"
          required
        />
        <p className="mt-2 text-xs text-slate-500" id="website-help">Enter the organization&apos;s official website, such as example.com or www.example.com.</p>
      </div>
      {state.error ? <p className="alert-error" role="alert">{state.error}</p> : null}
      <button className="button-primary w-full" disabled={pending} type="submit">
        {pending ? "Creating organization…" : "Create organization"}
      </button>
    </form>
  );
}
