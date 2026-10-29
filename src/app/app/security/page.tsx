import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/dal";
import { PendingWorkspace } from "@/components/pending-workspace";
import { MemberProfileForm } from "@/components/member-profile-form";
import { getMyJoinRequest } from "@/lib/auth/join-status";
import { accountTypeFromMetadata } from "@/lib/auth/signup-flow";
import { recoverJoinIntentPath } from "@/lib/auth/join-intent";
import { createClient } from "@/lib/supabase/server";
import type { DatabaseWithPendingOnboarding } from "@/types/pending-database.types";

export default async function SecurityAccessPage() {
  const context = await requireUser();
  if (context.kind === "inactive") redirect("/access-inactive");
  const supabase = await createClient<DatabaseWithPendingOnboarding>();
  const { data: profile, error: profileError } = await supabase.from("user_profiles")
    .select("full_name, phone, profile_photo_path")
    .eq("user_id", context.user.id)
    .maybeSingle();

  if (context.kind === "no_membership") {
    const accountType = accountTypeFromMetadata(context.user.user_metadata);
    if (accountType !== "security") redirect(accountType === "host" ? "/app/host" : "/onboarding");
    const request = await getMyJoinRequest();
    const recoveryPath = request ? null : recoverJoinIntentPath(context.user.user_metadata);
    if (recoveryPath) redirect(recoveryPath);
    return <PendingWorkspace role="security" request={request}>
      {profileError || !profile ? <p className="alert-error mt-6">Your profile could not be loaded.</p> : <MemberProfileForm role="security" email={context.user.email ?? ""} fullName={profile.full_name} phone={profile.phone} />}
    </PendingWorkspace>;
  }

  if (context.membership.role !== "security") redirect("/app");
  let profilePhotoUrl: string | null = null;
  if (profile?.profile_photo_path) {
    const { data } = await supabase.storage.from("member-profile-photos").createSignedUrl(profile.profile_photo_path, 3600);
    profilePhotoUrl = data?.signedUrl ?? null;
  }

  return <main className="content-shell">
    <section className="card">
      <div className="flex items-center gap-4">
        {profilePhotoUrl ? <Image unoptimized src={profilePhotoUrl} alt="Security profile" width={56} height={56} className="size-14 rounded-full object-cover" /> : <span className="flex size-14 items-center justify-center rounded-full bg-emerald-100 text-xl font-black text-emerald-800">{profile?.full_name?.charAt(0) ?? "S"}</span>}
        <div><p className="eyebrow">Security and reception</p><h1 className="title mt-1">Gate desk</h1></div>
      </div>
      <p className="copy">Manage visitor entry and exit for {context.organization.name}.</p>
      {!profile?.full_name || !profile.phone ? <p className="alert-error mt-5">Add your full name and phone number below.</p> : null}
    </section>
    <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <Link className="rounded-2xl bg-emerald-700 p-6 text-white shadow-lg shadow-emerald-900/10 transition hover:-translate-y-0.5 hover:bg-emerald-800" href="/app/security/scan"><span className="text-3xl" aria-hidden="true">▣</span><h2 className="mt-5 text-xl font-bold">Scan QR</h2><p className="mt-2 text-sm leading-6 text-emerald-50">Check visitors in or out.</p></Link>
      <Link className="card transition hover:-translate-y-0.5 hover:border-emerald-300" href="/app/security/new"><span className="text-3xl" aria-hidden="true">＋</span><h2 className="mt-5 text-xl font-bold">New visitor</h2><p className="mt-2 text-sm leading-6 text-slate-500">Register a walk-in.</p></Link>
      <Link className="card transition hover:-translate-y-0.5 hover:border-emerald-300" href="/app/security/inside"><span className="text-3xl" aria-hidden="true">●</span><h2 className="mt-5 text-xl font-bold">Currently inside</h2><p className="mt-2 text-sm leading-6 text-slate-500">See active visits.</p></Link>
      <Link className="card transition hover:-translate-y-0.5 hover:border-emerald-300" href="/app/security/visits"><span className="text-3xl" aria-hidden="true">☷</span><h2 className="mt-5 text-xl font-bold">Visit history</h2><p className="mt-2 text-sm leading-6 text-slate-500">Expected, inside, and past visits.</p></Link>
      <Link className="card transition hover:-translate-y-0.5 hover:border-emerald-300" href="/app/security/locations"><span className="text-3xl" aria-hidden="true">⌖</span><h2 className="mt-5 text-xl font-bold">Host locations</h2><p className="mt-2 text-sm leading-6 text-slate-500">Verify addresses before approval.</p></Link>
    </section>
    {profile ? <MemberProfileForm role="security" email={context.user.email ?? ""} fullName={profile.full_name} phone={profile.phone} /> : null}
    <aside className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950"><strong>Gate reminder:</strong> Confirm the person physically before recording entry.</aside>
  </main>;
}
