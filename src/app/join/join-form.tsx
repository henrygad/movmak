"use client";

import { useActionState, useEffect, useRef } from "react";
import { acceptInvitation } from "./actions";

export function JoinForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(acceptInvitation, { error: null, message: null });
  const formRef = useRef<HTMLFormElement>(null);
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    formRef.current?.requestSubmit();
  }, []);
  return <form ref={formRef} action={action} className="mt-8 space-y-5"><input type="hidden" name="token" value={token} /><p className="text-sm text-slate-600" role="status">{pending ? "Sending your membership request…" : "Your membership request will be sent automatically."}</p>{state.error ? <p className="alert-error" role="alert">{state.error}</p> : null}<button className="button-primary w-full" disabled={pending} type="submit">{pending ? "Sending request…" : state.error ? "Try again" : "Send request now"}</button></form>;
}
