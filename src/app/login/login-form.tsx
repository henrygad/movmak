"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

const initialState: LoginState = { error: null };

export function LoginForm({ nextPath }: { nextPath: string }) {
  const [state, action, pending] = useActionState(login, initialState);

  return (
    <form action={action} className="mt-8 space-y-5">
      <input type="hidden" name="next" value={nextPath} />
      <div>
        <label className="text-sm font-medium text-slate-800" htmlFor="email">
          Email address
        </label>
        <input className="field" id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div>
        <label className="text-sm font-medium text-slate-800" htmlFor="password">
          Password
        </label>
        <input className="field" id="password" name="password" type="password" autoComplete="current-password" minLength={8} required />
      </div>
      {state.error ? <p className="alert-error" role="alert">{state.error}</p> : null}
      <button className="button-primary w-full" disabled={pending} type="submit">
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
