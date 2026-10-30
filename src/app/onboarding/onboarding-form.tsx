"use client";

import { useActionState, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { createOrganization, type OnboardingState } from "./actions";

const initialState: OnboardingState = { error: null };

export function OnboardingForm() {
  const [state, action, pending] = useActionState(createOrganization, initialState);
  const [confirming, setConfirming] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const confirmedSubmission = useRef(false);

  return (
    <>
      <form
        ref={formRef}
        action={action}
        className="mt-8 space-y-5"
        encType="multipart/form-data"
        onSubmit={(event) => {
          if (confirmedSubmission.current) {
            confirmedSubmission.current = false;
            return;
          }
          event.preventDefault();
          setConfirming(true);
        }}
      >
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
          <p className="mt-2 text-xs text-slate-500" id="website-help">Enter the organization&apos;s official website, such as example.com.</p>
        </div>
        <div>
          <label className="text-sm font-medium text-slate-800" htmlFor="logo">Organization logo <span className="font-normal text-slate-500">(optional)</span></label>
          <input className="field file:mr-4 file:rounded-lg file:border-0 file:bg-emerald-100 file:px-3 file:py-2 file:font-semibold file:text-emerald-900" id="logo" name="logo" type="file" accept="image/png,image/jpeg,image/webp" />
          <p className="mt-2 text-xs text-slate-500">PNG, JPEG, or WebP. Must be smaller than 2 MB.</p>
        </div>
        {state.error ? <p className="alert-error" role="alert">{state.error}</p> : null}
        <button className="button-primary w-full" disabled={pending} type="submit">{pending ? "Creating organization…" : "Create organization"}</button>
      </form>
      <ConfirmDialog
        open={confirming}
        title="Create this organization?"
        description="You will become the first administrator and be responsible for approving organization members."
        confirmLabel="Create organization"
        onClose={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          confirmedSubmission.current = true;
          formRef.current?.requestSubmit();
        }}
      />
    </>
  );
}
