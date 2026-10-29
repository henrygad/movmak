"use client";

import { useActionState } from "react";
import { updateOrganizationSettings } from "./actions";

export function OrganizationSettingsForm({ website }: { website: string | null }) {
  const [state, action, pending] = useActionState(updateOrganizationSettings, { error: null, message: null });
  return (
    <form action={action} className="card mt-6" encType="multipart/form-data">
      <div className="grid gap-5">
        <label className="text-sm font-semibold text-slate-800">
          Organization URL
          <input className="field font-normal" name="website" defaultValue={website ?? ""} placeholder="example.com" inputMode="url" autoComplete="url" required />
          <span className="mt-2 block text-xs font-normal text-slate-500">Your official website. HTTPS is added when the scheme is omitted.</span>
        </label>
        <label className="text-sm font-semibold text-slate-800">
          Organization logo
          <input className="field font-normal file:mr-4 file:rounded-lg file:border-0 file:bg-emerald-100 file:px-3 file:py-2 file:font-semibold file:text-emerald-900" name="logo" type="file" accept="image/png,image/jpeg,image/webp" />
          <span className="mt-2 block text-xs font-normal text-slate-500">PNG, JPEG, or WebP. Must be smaller than 2 MB.</span>
        </label>
      </div>
      {state.error ? <p className="alert-error mt-5" role="alert">{state.error}</p> : null}
      {state.message ? <p className="alert-success mt-5" role="status">{state.message}</p> : null}
      <button className="button-primary mt-6" disabled={pending}>{pending ? "Saving…" : "Save settings"}</button>
    </form>
  );
}

