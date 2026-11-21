import Link from "next/link";
import { requireUser } from "@/lib/auth/dal";
import { PhoneVerificationForm } from "@/components/phone-verification-form";
import { acceptFamilyInvitation } from "@/app/app/resident/family/actions";

export default async function AcceptFamilyInvitationPage({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const { token = "", error } = await searchParams;
  const context = await requireUser();
  const verifiedPhone = context.user.phone_confirmed_at ? context.user.phone ?? null : null;
  return <main className="page-shell"><section className="card w-full max-w-lg"><div className="wordmark"><span className="wordmark-mark">M</span><span>Movmak</span></div><p className="eyebrow mt-7">Family invitation</p><h1 className="title">Join this household</h1><p className="copy">Use the invited email account and verify your phone before accepting.</p>{error ? <p className="alert-error mt-5" role="alert">This invitation is invalid, expired, already used, or does not match this account.</p> : null}<div className="mt-6"><PhoneVerificationForm verifiedPhone={verifiedPhone} /></div>{verifiedPhone ? <form action={acceptFamilyInvitation} className="mt-5"><input type="hidden" name="token" value={token} /><button className="button-primary w-full">Accept household invitation</button></form> : <p className="mt-4 text-sm text-amber-800">Verify your phone above to continue.</p>}<Link className="link-button mt-5 inline-block" href="/app">Return to workspace</Link></section></main>;
}
