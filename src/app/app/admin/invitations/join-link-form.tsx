"use client";

import { useActionState, useState, useTransition } from "react";
import { createJoinLink, revokeJoinLink, rotateJoinLink, type JoinLinkState } from "./actions";

const initial: JoinLinkState = { error: null, joinPath: null, message: null };

export function JoinLinkForm() {
  const [state, action, pending] = useActionState(createJoinLink, initial);
  return <form action={action} className="mt-6 grid gap-4 sm:grid-cols-3"><label className="text-sm font-semibold">Requested role<select className="field" name="role" defaultValue="host"><option value="host">Resident, worker or host</option><option value="security">Security or reception</option></select></label><label className="text-sm font-semibold">Expires after<select className="field" name="durationDays" defaultValue="7"><option value="1">1 day</option><option value="7">7 days</option><option value="30">30 days</option></select></label><button className="button-primary self-end" disabled={pending}>{pending ? "Creating…" : "Create join link"}</button>{state.error ? <p className="alert-error sm:col-span-3" role="alert">{state.error}</p> : null}{state.joinPath ? <JoinPath path={state.joinPath} message={state.message} /> : null}</form>;
}

function JoinPath({ path, message }: { path: string; message: string | null }) {
  const [feedback, setFeedback] = useState(message);
  return <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 sm:col-span-3"><p className="font-semibold text-emerald-950">{feedback}</p><p className="mt-2 break-all text-sm text-emerald-900">{path}</p><button className="button-secondary mt-3" type="button" onClick={async () => { await navigator.clipboard.writeText(`${window.location.origin}${path}`); setFeedback("Join link copied."); }}>Copy link</button></div>;
}

export function JoinLinkActions({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<JoinLinkState>(initial);
  return <div className="flex flex-wrap gap-2"><button className="button-secondary" disabled={pending} onClick={() => startTransition(async () => setState(await rotateJoinLink(id, 7)))}>{pending ? "Working…" : "Rotate"}</button><button className="button-ghost" disabled={pending} onClick={() => startTransition(async () => { const result = await revokeJoinLink(id); setState({ error: result.error, message: result.message, joinPath: null }); })}>Revoke</button>{state.error ? <p className="w-full text-xs text-red-800" role="alert">{state.error}</p> : null}{state.joinPath ? <JoinPath path={state.joinPath} message={state.message} /> : state.message ? <p className="w-full text-xs text-emerald-800" role="status">{state.message}</p> : null}</div>;
}
