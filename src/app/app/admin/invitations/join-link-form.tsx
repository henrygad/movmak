"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { createJoinLink, revokeJoinLink, type JoinLinkState } from "./actions";

const initial: JoinLinkState = { error: null, joinLinkId: null, joinPath: null, message: null };
const storageKey = (id: string) => `movmak:join-link:${id}`;

export function JoinLinkForm() {
  const [state, action, pending] = useActionState(createJoinLink, initial);

  useEffect(() => {
    if (state.joinLinkId && state.joinPath) {
      window.sessionStorage.setItem(storageKey(state.joinLinkId), state.joinPath);
    }
  }, [state.joinLinkId, state.joinPath]);

  return <form action={action} className="mt-6 grid gap-4 sm:grid-cols-3">
    <label className="text-sm font-semibold">Role
      <select className="field" name="role" defaultValue="host"><option value="host">Resident, worker or host</option><option value="security">Security or reception</option></select>
    </label>
    <label className="text-sm font-semibold">Expires after
      <select className="field" name="durationDays" defaultValue="7"><option value="1">1 day</option><option value="7">7 days</option><option value="30">30 days</option></select>
    </label>
    <button className="button-primary self-end" disabled={pending}>{pending ? "Creating…" : "Create join link"}</button>
    {state.error ? <p className="alert-error sm:col-span-3" role="alert">{state.error}</p> : null}
    {state.joinPath ? <JoinPath path={state.joinPath} message={state.message} /> : null}
  </form>;
}

function JoinPath({ path, message }: { path: string; message: string | null }) {
  const [feedback, setFeedback] = useState(message);
  const [copied, setCopied] = useState(false);
  return <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 sm:col-span-3">
    <p className="font-semibold text-emerald-950" role="status">{feedback}</p>
    <p className="mt-2 break-all text-sm text-emerald-900">{path}</p>
    <button className="button-secondary mt-3" type="button" onClick={async () => {
      await navigator.clipboard.writeText(`${window.location.origin}${path}`);
      setCopied(true);
      setFeedback("Join link copied.");
      window.setTimeout(() => setCopied(false), 2000);
    }}>{copied ? "Copied" : "Copy link"}</button>
  </div>;
}

export function JoinLinkActions({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [viewPath, setViewPath] = useState<string | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [revokeOpen, setRevokeOpen] = useState(false);

  function viewLink() {
    const path = window.sessionStorage.getItem(storageKey(id));
    setViewPath(path);
    setMessage(path ? null : "This browser no longer has the secret link. Revoke it and create a new one if you need another copy.");
    setViewOpen(true);
  }

  return <div className="flex flex-wrap gap-2">
    <button className="button-secondary" type="button" disabled={pending} onClick={viewLink}>View</button>
    <button className="button-ghost" type="button" disabled={pending} onClick={() => setRevokeOpen(true)}>Revoke</button>
    {message ? <p className="w-full text-xs text-slate-600" role="status">{message}</p> : null}
    <ConfirmDialog
      open={viewOpen}
      title="Organization join link"
      description={viewPath ? `${window.location.origin}${viewPath}` : "For security, Movmak stores only a hash of the link. This browser does not have the original secret."}
      confirmLabel={viewPath ? "Copy link" : "Close"}
      cancelLabel="Back"
      onClose={() => setViewOpen(false)}
      onConfirm={() => {
        if (viewPath) {
          void navigator.clipboard.writeText(`${window.location.origin}${viewPath}`);
          setMessage("Join link copied.");
        }
        setViewOpen(false);
      }}
    />
    <ConfirmDialog
      open={revokeOpen}
      title="Revoke this join link?"
      description="Anyone with this URL will immediately lose the ability to request membership. This cannot be undone."
      confirmLabel="Revoke link"
      dangerous
      onClose={() => setRevokeOpen(false)}
      onConfirm={() => {
        setRevokeOpen(false);
        startTransition(async () => {
          const result = await revokeJoinLink(id);
          if (!result.error) window.sessionStorage.removeItem(storageKey(id));
          setMessage(result.error ?? result.message);
        });
      }}
    />
  </div>;
}
