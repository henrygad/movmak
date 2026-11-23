"use client";

import { useEffect, useState } from "react";
import { normalizePhoneNumber } from "@/lib/phones/normalize";
import { createClient } from "@/lib/supabase/client";
import type { DatabaseWithPendingOnboarding } from "@/types/pending-database.types";

const resendDelaySeconds = 60;

export function PhoneLoginForm({ nextPath }: { nextPath: string }) {
  const [phoneInput, setPhoneInput] = useState("");
  const [phone, setPhone] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [secondsUntilResend, setSecondsUntilResend] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (secondsUntilResend <= 0) return;
    const timer = window.setInterval(() => {
      setSecondsUntilResend((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [secondsUntilResend]);

  async function requestCode() {
    const normalized = normalizePhoneNumber(phoneInput);
    if (!normalized.ok) {
      setError(normalized.error);
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);
    const { error: otpError } = await createClient().auth.signInWithOtp({
      phone: normalized.value,
      options: { shouldCreateUser: false },
    });
    setBusy(false);

    if (otpError) {
      setError("A sign-in code could not be requested. Wait a moment and try again.");
      return;
    }

    setPhone(normalized.value);
    setPhoneInput(normalized.value);
    setCode("");
    setSecondsUntilResend(resendDelaySeconds);
    setMessage("Enter the six-digit code for this phone number.");
  }

  async function verifyCode() {
    if (!phone || !/^\d{6}$/.test(code)) {
      setError("Enter the six-digit code.");
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);
    const supabase = createClient<DatabaseWithPendingOnboarding>();
    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      phone,
      token: code,
      type: "sms",
    });

    if (verifyError || !data.session) {
      setBusy(false);
      setError("That code is invalid or expired. Request another code and try again.");
      return;
    }

    const { data: syncedPhone, error: syncError } = await supabase.rpc("sync_my_verified_phone");
    if (syncError || !syncedPhone) {
      setBusy(false);
      setError("You are signed in, but the verified phone could not be saved. Refresh and try again.");
      return;
    }

    window.location.assign(nextPath);
  }

  function changeNumber() {
    setPhone(null);
    setCode("");
    setSecondsUntilResend(0);
    setError(null);
    setMessage(null);
  }

  return (
    <section className="mt-8 border-t border-slate-200 pt-8" aria-labelledby="phone-login-title">
      <h2 id="phone-login-title" className="text-lg font-bold text-slate-950">Sign in with phone</h2>
      <p className="mt-1 text-sm text-slate-600">Use a phone number already verified on your Movmak account.</p>
      {!phone ? (
        <div className="mt-4 space-y-4">
          <label className="block text-sm font-medium text-slate-800" htmlFor="login-phone">
            Nigerian phone number
            <input
              className="field font-normal"
              id="login-phone"
              value={phoneInput}
              onChange={(event) => { setPhoneInput(event.target.value); setError(null); }}
              inputMode="tel"
              autoComplete="tel"
              placeholder="0803 123 4567"
              disabled={busy}
            />
          </label>
          <button className="button-secondary w-full" type="button" onClick={requestCode} disabled={busy}>
            {busy ? "Requesting code…" : "Send sign-in code"}
          </button>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-slate-700">Code requested for <strong>{phone}</strong></p>
          <label className="block text-sm font-medium text-slate-800" htmlFor="login-phone-code">
            Verification code
            <input
              className="field font-normal tracking-widest"
              id="login-phone-code"
              value={code}
              onChange={(event) => { setCode(event.target.value.replace(/\D/g, "").slice(0, 6)); setError(null); }}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="6-digit code"
              disabled={busy}
            />
          </label>
          <button className="button-primary w-full" type="button" onClick={verifyCode} disabled={busy || code.length !== 6}>
            {busy ? "Verifying…" : "Verify and sign in"}
          </button>
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <button className="link-button" type="button" onClick={changeNumber} disabled={busy}>Change number</button>
            <button className="link-button" type="button" onClick={requestCode} disabled={busy || secondsUntilResend > 0}>
              {secondsUntilResend > 0 ? `Resend in ${secondsUntilResend}s` : "Resend code"}
            </button>
          </div>
        </div>
      )}
      {error ? <p className="alert-error mt-4" role="alert">{error}</p> : null}
      {message ? <p className="alert-success mt-4" role="status">{message}</p> : null}
    </section>
  );
}
