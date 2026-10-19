"use client";

import Image from "next/image";
import { useActionState, useState } from "react";
import { emptyRegistrationState, registerVisitor, type RegistrationState } from "./actions";

export function RegistrationForm({ token, initialState = emptyRegistrationState }: {
  token: string;
  initialState?: RegistrationState;
}) {
  const [state, action, pending] = useActionState(registerVisitor, initialState);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function shareQr() {
    if (!state.qrDataUrl || !state.visitReference) return;
    try {
      const blob = await (await fetch(state.qrDataUrl)).blob();
      const file = new File([blob], `movmak-${state.visitReference}.png`, { type: "image/png" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) { await navigator.share({ title: `Movmak visit ${state.visitReference}`, text: "My Movmak visit QR", files: [file] }); setFeedback("QR shared."); }
      else setFeedback("Sharing is unavailable here. Download the QR instead.");
    } catch { setFeedback("Sharing was cancelled or unavailable."); }
  }

  if (state.visitReference && state.qrDataUrl) {
    return <section className="card text-center print:border-0 print:p-0 print:shadow-none">
      <div className="wordmark justify-center"><span className="wordmark-mark">M</span><span>Movmak</span></div>
      {state.organization ? <div className="mt-6 flex items-center justify-center gap-3">
        {state.organization.logoUrl ? <Image unoptimized src={state.organization.logoUrl} alt={`${state.organization.name} logo`} width={48} height={48} className="size-12 rounded-xl object-contain" /> : <span aria-hidden="true" className="flex size-12 items-center justify-center rounded-xl bg-emerald-100 text-lg font-black text-emerald-800">{state.organization.name.charAt(0)}</span>}
        <p className="text-left text-lg font-bold text-slate-950">{state.organization.name}</p>
      </div> : null}
      <p className="eyebrow mt-6">Registration complete</p>
      <h1 className="title">Your visit QR is ready</h1>
      <p className="copy mx-auto">Visit ID <strong>{state.visitReference}</strong>. Show this QR to security at the gate. Registration does not check you in.</p>
      <div className="mx-auto mt-6 max-w-sm rounded-2xl border border-slate-200 bg-white p-4 shadow-sm print:border-0 print:shadow-none"><Image unoptimized width={640} height={640} className="h-auto w-full" src={state.qrDataUrl} alt={`QR credential for visit ${state.visitReference}`} /></div>
      {feedback ? <p className="alert-success mt-5 print:hidden" role="status">{feedback}</p> : null}
      <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row print:hidden">
        <a className="button-primary" href={state.qrDataUrl} download={`movmak-${state.visitReference}.png`}>Download QR</a>
        <button className="button-secondary" type="button" onClick={() => window.print()}>Print QR</button>
        <button className="button-secondary" type="button" onClick={shareQr}>Share QR</button>
      </div>
      <p className="mt-5 text-sm text-slate-500">Save, print, or screenshot this QR. Keep it private and use it only for this visit.</p>
    </section>;
  }

  return <form action={action} className="card"><div className="wordmark"><span className="wordmark-mark">M</span><span>Movmak</span></div><p className="eyebrow mt-8">Visitor registration</p><h1 className="title">Tell us about your visit</h1><p className="copy">Use the details security will use to confirm your arrival. This invitation expires after five minutes.</p><input type="hidden" name="token" value={token} />{state.error ? <p className="alert-error mt-5" role="alert">{state.error}</p> : null}<div className="mt-7 grid gap-5"><label className="text-sm font-bold text-slate-800">Full name<input className="field font-normal" name="fullName" minLength={2} maxLength={160} autoComplete="name" required /></label><label className="text-sm font-bold text-slate-800">Phone number<input className="field font-normal" name="phone" minLength={3} maxLength={40} inputMode="tel" autoComplete="tel" required /></label><label className="text-sm font-bold text-slate-800">Purpose of visit<textarea className="field min-h-24 resize-y font-normal" name="purpose" minLength={2} maxLength={500} required /></label><label className="text-sm font-bold text-slate-800">Number of people entering<input className="field font-normal" name="groupSize" type="number" min={1} max={100} defaultValue={1} required /><span className="mt-2 block text-xs font-normal text-slate-500">Include yourself and any companions.</span></label></div><button className="button-primary mt-7 w-full" disabled={pending}>{pending ? "Registering securely…" : "Register and get QR"}</button></form>;
}
