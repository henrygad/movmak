"use client";

import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { getHostCredentials } from "./actions";
import type { HostCredentialState } from "@/lib/host/current-credentials";

const subscribeToOrigin = () => () => {};
const getBrowserOrigin = (): string | null => window.location.origin;
const getServerOrigin = (): string | null => null;

export function CredentialPanel({ initialState }: { initialState: HostCredentialState }) {
  const [state, setState] = useState(initialState);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const origin = useSyncExternalStore(subscribeToOrigin, getBrowserOrigin, getServerOrigin);
  const invitationUrl = state.invitationPath && origin ? new URL(state.invitationPath, origin).toString() : null;

  useEffect(() => {
    if (!state.expiresAt) return;
    const expiry = Date.parse(state.expiresAt);
    const update = () => setSecondsLeft(Math.max(0, Math.ceil((expiry - Date.now()) / 1000)));
    const initial = window.setTimeout(update, 0);
    const interval = window.setInterval(update, 1000);
    return () => { window.clearTimeout(initial); window.clearInterval(interval); };
  }, [state.expiresAt]);

  useEffect(() => {
    if (!state.expiresAt || state.error || pending) return;
    const timeout = window.setTimeout(() => load(false), Math.max(1000, Date.parse(state.expiresAt) - Date.now() + 1000));
    return () => window.clearTimeout(timeout);
  }, [state.expiresAt, state.error, pending]);

  function load(refresh: boolean) {
    setFeedback(null);
    startTransition(async () => {
      try {
        const next = await getHostCredentials(refresh);
        setState(next);
        if (!next.error) setFeedback(refresh ? "New credentials are ready. The previous pair is no longer valid." : "Your invitation and code are ready.");
      } catch {
        setState((previous) => ({ ...previous, error: "Your session may have expired. Sign in again and retry." }));
      }
    });
  }

  async function copy(target: "code" | "link", label: string, value: string) {
    try { await navigator.clipboard.writeText(value); setCopied(target); setFeedback(`${label} copied.`); window.setTimeout(() => setCopied((current) => current === target ? null : current), 2000); }
    catch { setFeedback(`Could not copy the ${label.toLowerCase()}. Select it and copy manually.`); }
  }

  async function share() {
    if (!invitationUrl) return;
    try {
      if (navigator.share) { await navigator.share({ title: "Movmak visitor invitation", text: "Use this link to register your visit.", url: invitationUrl }); setFeedback("Invitation shared."); }
      else await copy("link", "Invitation link", invitationUrl);
    } catch { setFeedback("Sharing was cancelled or unavailable."); }
  }

  const usable = Boolean(state.hostCode && invitationUrl && secondsLeft !== null && secondsLeft > 0);
  const countdown = secondsLeft === null ? "Checking time…" : `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`;

  return <section className="card mt-6" aria-labelledby="host-credentials-heading">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
      <div><p className="eyebrow">Temporary visitor access</p><h2 id="host-credentials-heading" className="section-heading mt-2">Your invitation and host code</h2><p className="copy">This link and code are valid for five minutes. Refreshing revokes the old pair.</p></div>
      <button className="button-primary shrink-0" type="button" onClick={() => load(Boolean(state.hostCode))} disabled={pending}>{pending ? "Preparing…" : state.hostCode ? "Refresh now" : "Get invitation and code"}</button>
    </div>
    {state.error ? <p className="alert-error mt-5" role="alert">{state.error}</p> : null}
    {feedback ? <p className="alert-success mt-5" role="status">{feedback}</p> : null}
    {state.hostCode && invitationUrl ? <div className="mt-6 grid gap-4 lg:grid-cols-[0.75fr_1.25fr]">
      <div className="rounded-2xl bg-slate-950 p-5 text-white"><p className="text-xs font-bold uppercase tracking-widest text-emerald-300">Four-digit host code</p><p className="mt-4 font-mono text-4xl font-black tracking-[0.22em]">{state.hostCode}</p><button className="mt-5 text-sm font-bold text-emerald-300 hover:text-emerald-200 disabled:opacity-50" type="button" disabled={!usable || pending} onClick={() => copy("code", "Host code", state.hostCode ?? "")}>{copied === "code" ? "Copied" : "Copy code"}</button></div>
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5"><p className="text-xs font-bold uppercase tracking-widest text-slate-500">Visitor invitation link</p><p className="mt-3 break-all text-sm leading-6 text-slate-700">{invitationUrl}</p><div className="mt-5 flex flex-wrap gap-2"><button className="button-secondary" type="button" disabled={!usable || pending} onClick={() => copy("link", "Invitation link", invitationUrl)}>{copied === "link" ? "Copied" : "Copy link"}</button><button className="button-secondary" type="button" disabled={!usable || pending} onClick={share}>Share link</button></div></div>
      <p className="text-sm font-medium text-amber-800 lg:col-span-2" role="status">{usable ? `Expires in ${countdown}.` : "This pair has expired. Refresh it before sharing."} A visitor&apos;s QR remains separate from this temporary invitation.</p>
    </div> : <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center"><p className="font-semibold text-slate-800">No current credentials on this device</p><p className="mt-1 text-sm text-slate-500">Get a pair when you are ready to invite a visitor. A new pair revokes one made on another device.</p></div>}
  </section>;
}
