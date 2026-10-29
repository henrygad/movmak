"use client";

import { useActionState, useState, useTransition } from "react";
import { registerGateVisitor, verifyHostCode, type GateResult, type HostVerification } from "../actions";
import { VISIT_PURPOSES } from "@/lib/visits/validation";

const initial: GateResult = { error: null, message: null };
const noVerification: HostVerification = { error: null, hostMembershipId: null, hostName: null, attemptId: null };

export function NewVisitorForm({ hosts }: { hosts: { host_membership_id: string; host_name: string }[] }) {
  const [state, action, pending] = useActionState(registerGateVisitor, initial);
  const [verification, setVerification] = useState(noVerification);
  const [code, setCode] = useState("");
  const [verifying, startVerification] = useTransition();
  const [noPhone, setNoPhone] = useState(false);

  return <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
    <section className="card">
      <p className="eyebrow">No-smartphone verification</p>
      <h2 className="mt-2 text-2xl font-semibold">Verify host code</h2>
      <p className="copy">Ask the visitor for the host&apos;s current four-digit code.</p>
      <label className="mt-5 block font-semibold">Host code
        <input
          className="field font-mono tracking-[0.2em]"
          inputMode="numeric"
          maxLength={4}
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 4))}
        />
      </label>
      <button type="button" className="button-secondary mt-3" disabled={verifying || code.length !== 4} onClick={() => startVerification(async () => setVerification(await verifyHostCode(code)))}>{verifying ? "Verifying…" : "Verify code"}</button>
      {verification.error ? <p className="alert-error mt-4" role="alert">{verification.error}</p> : null}
      {verification.hostMembershipId ? <p className="mt-4 rounded-lg bg-emerald-50 p-4 font-semibold text-emerald-900">Verified: {verification.hostName}</p> : null}
    </section>

    <form action={action} className="card">
      <p className="eyebrow">Gate registration</p>
      <h1 className="title">New visitor</h1>
      {state.error ? <p className="alert-error mt-5" role="alert">{state.error}</p> : null}
      {state.message ? <p className="alert-success mt-5" role="status">{state.message}</p> : null}
      <div className="mt-6 grid gap-5">
        <label className="font-semibold">Full name<input className="field font-normal" name="fullName" required minLength={2} maxLength={160} /></label>
        <label className="font-semibold">Phone number<input className="field font-normal" name="phone" disabled={noPhone} required={!noPhone} /></label>
        <label className="flex items-center gap-3 font-medium"><input type="checkbox" name="phoneNotProvided" checked={noPhone} onChange={(event) => setNoPhone(event.target.checked)} /> Phone not provided</label>
        {verification.hostMembershipId ? <>
          <input type="hidden" name="hostMembershipId" value={verification.hostMembershipId} />
          <input type="hidden" name="hostCodeAttemptId" value={verification.attemptId ?? ""} />
          <p className="rounded-lg border border-emerald-200 p-3">Host: <strong>{verification.hostName}</strong></p>
        </> : <label className="font-semibold">Person being visited
          <select className="field font-normal" name="hostMembershipId" required defaultValue="">
            <option value="" disabled>Select a host</option>
            {hosts.map((host) => <option key={host.host_membership_id} value={host.host_membership_id}>{host.host_name}</option>)}
          </select>
        </label>}
        <label className="font-semibold">Purpose
          <select className="field font-normal" name="purpose" defaultValue="" required>
            <option value="" disabled>Choose a reason</option>
            {VISIT_PURPOSES.map((purpose) => <option key={purpose} value={purpose}>{purpose}</option>)}
          </select>
        </label>
        <label className="font-semibold">Companions<input className="field font-normal" name="companionCount" type="number" min={0} max={99} defaultValue={0} required /><span className="mt-2 block text-xs font-normal text-slate-500">Do not include the primary visitor.</span></label>
      </div>
      <button className="button-primary mt-7 w-full" disabled={pending}>{pending ? "Checking in…" : "Register and check in"}</button>
    </form>
  </div>;
}
