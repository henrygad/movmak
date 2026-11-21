"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { normalizePhoneNumber } from "@/lib/phones/normalize";
import { createClient } from "@/lib/supabase/client";
import { syncVerifiedPhone } from "@/app/app/phone-verification-actions";

export function PhoneVerificationForm({ verifiedPhone }: { verifiedPhone: string | null }) {
  const router = useRouter();
  const [phone, setPhone] = useState(verifiedPhone ?? "");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [secondsUntilResend, setSecondsUntilResend] = useState(0);

  useEffect(() => {
    if (secondsUntilResend <= 0) return;
    const timer = window.setInterval(() => {
      setSecondsUntilResend((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [secondsUntilResend]);

  async function sendCode() {
    const normalized = normalizePhoneNumber(phone);
    if (!normalized.ok) { setError(normalized.error); return; }
    setBusy(true); setError(null); setMessage(null);
    const { error: updateError } = await createClient().auth.updateUser({ phone: normalized.value });
    setBusy(false);
    if (updateError) { setError("A verification code could not be requested. Wait a moment and try again."); return; }
    setPhone(normalized.value); setCodeSent(true); setSecondsUntilResend(60); setMessage("Enter the six-digit code for this phone number.");
  }

  async function verifyCode() {
    if (!/^\d{6}$/.test(code)) { setError("Enter the six-digit SMS code."); return; }
    setBusy(true); setError(null); setMessage(null);
    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.verifyOtp({ phone, token: code, type: "phone_change" });
    if (verifyError) {
      setBusy(false);
      if (verifyError.code === "refresh_token_not_found") {
        await supabase.auth.signOut({ scope: "local" });
        router.replace("/login?phoneVerification=session-expired");
        router.refresh();
        return;
      }
      setError("That code is invalid or expired. Request a new code and try again.");
      return;
    }
    const synced = await syncVerifiedPhone();
    setBusy(false);
    if (synced.error || !synced.phone) { setError(synced.error ?? "Your verified phone could not be saved."); return; }
    setPhone(synced.phone); setCode(""); setCodeSent(false); setMessage("Phone number verified.");
  }

  return <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
    <p className="text-sm font-bold text-slate-900">Verified phone</p>
    <p className="mt-1 text-xs text-slate-600">Supabase Auth verifies the code. Movmak stores only the verified number and timestamp.</p>
    <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
      <input className="field mt-0" value={phone} onChange={(event) => { setPhone(event.target.value); setCodeSent(false); setError(null); }} inputMode="tel" autoComplete="tel" placeholder="0803 123 4567" disabled={busy} />
      <button className="button-secondary" type="button" onClick={sendCode} disabled={busy || (codeSent && secondsUntilResend > 0)}>{busy ? "Please wait…" : codeSent && secondsUntilResend > 0 ? `Resend in ${secondsUntilResend}s` : verifiedPhone ? "Change phone" : codeSent ? "Resend code" : "Send code"}</button>
    </div>
    {codeSent ? <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]"><input className="field mt-0" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="6-digit code" /><button className="button-primary" type="button" onClick={verifyCode} disabled={busy}>Verify phone</button></div> : null}
    {error ? <p className="alert-error mt-3" role="alert">{error}</p> : null}
    {message ? <p className="alert-success mt-3" role="status">{message}</p> : null}
  </section>;
}
