"use client";

import { useActionState } from "react";
import { acceptInvitation } from "./actions";

export function JoinForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(acceptInvitation, { error: null, message: null });
  return <form action={action} className="mt-8 space-y-5"><input type="hidden" name="token" value={token} />{state.error ? <p className="alert-error" role="alert">{state.error}</p> : null}{state.message ? <p className="alert-success" role="status">{state.message}</p> : null}<button className="button-primary w-full" disabled={pending || Boolean(state.message)} type="submit">{pending ? "Sending request…" : state.message ? "Request pending" : "Request to join"}</button></form>;
}
