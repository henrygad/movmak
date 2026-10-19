import Image from "next/image";
import { requireActiveMembership } from "@/lib/auth/dal";
import { emptyHostCredentialState, readCurrentHostCredentials } from "@/lib/host/current-credentials";
import { createClient } from "@/lib/supabase/server";
import { CredentialPanel } from "./credential-panel";
import { ProfileForm } from "./profile-form";

export default async function HostAccessPage() {
  const context = await requireActiveMembership(["host"]);
  const supabase = await createClient();
  const { data: profile, error: profileError } = await supabase.from("user_profiles")
    .select("full_name, phone").eq("user_id", context.user.id).maybeSingle();
  const serverSecret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const initialState = serverSecret
    ? await readCurrentHostCredentials({ userId: context.user.id, membershipId: context.membership.id, organizationId: context.organization.id }, serverSecret)
      .then((value) => value ?? emptyHostCredentialState)
      .catch(() => ({ ...emptyHostCredentialState, error: "Current credentials could not be checked. Please retry." }))
    : { ...emptyHostCredentialState, error: "Credential generation is not configured." };
  const logoUrl = context.organization.logo_url?.startsWith("https://") ? context.organization.logo_url : null;

  return <main className="content-shell">
    <section className="card" aria-labelledby="host-home-heading">
      <p className="eyebrow">Resident / host home</p>
      <div className="mt-3 flex items-center gap-4">
        {logoUrl ? <Image unoptimized className="size-14 rounded-xl object-contain" src={logoUrl} alt={`${context.organization.name} logo`} width={56} height={56} /> : <span aria-hidden="true" className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-xl font-black text-emerald-800">{context.organization.name.charAt(0)}</span>}
        <div><h1 id="host-home-heading" className="title mt-0">{context.organization.name}</h1><p className="text-sm text-slate-600">Signed in as {profile?.full_name ?? context.user.email ?? "Host"}</p></div>
      </div>
      <p className="copy">Invite visitors with your own temporary link or code. Your account does not show visitor lists.</p>
      {profileError || !profile ? <p className="alert-error mt-5" role="alert">Your profile could not be loaded. Refresh this page or ask an administrator for help.</p> : null}
    </section>
    <CredentialPanel initialState={initialState} />
    {profile ? <ProfileForm fullName={profile.full_name} phone={profile.phone} /> : null}
    <section className="card mt-6" aria-labelledby="host-help-heading">
      <p className="eyebrow">How visitor invitations work</p><h2 id="host-help-heading" className="section-heading mt-2">A simple visit from invite to exit</h2>
      <ol className="mt-5 list-decimal space-y-3 pl-5 text-sm leading-6 text-slate-700">
        <li>Share your temporary invitation link with the visitor.</li>
        <li>They open it and enter their name, phone number, and reason for visiting.</li>
        <li>They receive a visit QR to show security at the gate.</li>
        <li>Security checks them in when they arrive and checks them out when they leave.</li>
        <li>No smartphone? Ask the visitor to call you. Give them your current six-digit code for security to verify before recording the visit.</li>
      </ol>
      <p className="mt-5 text-sm font-medium text-amber-800">Your link and code expire after five minutes. The visitor&apos;s visit QR is a separate credential and remains usable only for that visit.</p>
    </section>
  </main>;
}
