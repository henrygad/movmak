"use client";

import { useActionState } from "react";
import { signup, type SignupState } from "./actions";
import { PasswordField } from "@/components/password-field";

const initialState: SignupState = { error: null, submitted: false };

export function SignupForm({ nextPath, accountLabel, accountType }: { nextPath: string; accountLabel: string; accountType: "admin" | "host" | "security" }) {
  const [state, action, pending] = useActionState(signup, initialState);
  if (state.submitted) return <p className="mt-8 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-900" role="status">Check your inbox or spam folder and confirm your email. Then sign in. {accountLabel === "Organization owner" ? "Organization setup comes next." : "An administrator must approve access."}</p>;
  return <form action={action} className="mt-8 space-y-5">
    <input type="hidden" name="next" value={nextPath} />
    <input type="hidden" name="accountType" value={accountType} />
    <div><label className="text-sm font-medium text-slate-800" htmlFor="fullName">Full name</label><input className="field" id="fullName" name="fullName" minLength={2} maxLength={160} autoComplete="name" required /></div>
    <div><label className="text-sm font-medium text-slate-800" htmlFor="email">Email address</label><input className="field" id="email" name="email" type="email" autoComplete="email" required /></div>
    <div><label className="text-sm font-medium text-slate-800" htmlFor="password">Password</label><PasswordField autoComplete="new-password" minLength={12} /><p className="mt-2 text-xs text-slate-500">Use at least 12 characters.</p></div>
    {state.error ? <p className="alert-error" role="alert">{state.error}</p> : null}
    <button className="button-primary w-full" disabled={pending} type="submit">{pending ? "Creating account…" : "Create account"}</button>
  </form>;
}
