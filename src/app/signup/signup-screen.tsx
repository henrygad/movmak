import Image from "next/image";
import Link from "next/link";
import { logout } from "@/app/login/actions";
import { getAccessContext } from "@/lib/auth/dal";
import { joinPath } from "@/lib/auth/signup-flow";
import type { OrganizationRole } from "@/lib/auth/access";
import { isPlausibleInvitationToken } from "@/lib/auth/invitations";
import { SignupForm } from "./signup-form";
import { redirect } from "next/navigation";
import { previewJoinBranding } from "@/lib/auth/join-status";

const descriptions = {
  admin: { label: "Organization owner", title: "Create an organization", help: "Register, confirm your email, and set up your organization." },
  host: { label: "Resident or worker", title: "Create a host account", help: "Use your organization link. Access starts after approval." },
  security: { label: "Security or reception", title: "Create a security account", help: "Use your organization link. Gate tools start after approval." },
} as const;

export async function SignupScreen({ role, token = "" }: { role: OrganizationRole; token?: string }) {
  const context = await getAccessContext();
  const memberNeedsLink = role !== "admin" && !token;
  const invalidLink = Boolean(token) && !isPlausibleInvitationToken(token);
  const nextPath = token && !invalidLink ? joinPath(token) : "/onboarding";
  const copy = role === "admin" && token ? { label: "Invited administrator", title: "Join as an administrator", help: "Register and confirm your email. Access starts after approval." } : descriptions[role];
  const branding = token && !invalidLink ? await previewJoinBranding(token) : null;
  if (context.kind !== "unauthenticated" && token && !invalidLink) redirect(nextPath);

  return <main className="page-shell"><section className="card w-full max-w-md"><div className="wordmark"><span className="wordmark-mark">M</span><span>Movmak</span></div><p className="eyebrow mt-8">{copy.label} registration</p><h1 className="title">{copy.title}</h1><p className="copy">{copy.help}</p>
    {branding ? <div className="mt-5 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">{branding.organization_logo_url ? <Image unoptimized src={branding.organization_logo_url} alt={`${branding.organization_name} logo`} width={44} height={44} className="size-11 rounded-lg object-contain" /> : <span className="flex size-11 items-center justify-center rounded-lg bg-emerald-100 font-black text-emerald-900">{branding.organization_name.charAt(0)}</span>}<p className="font-semibold text-slate-900">Joining {branding.organization_name}</p></div> : null}
    {context.kind !== "unauthenticated" ? <div className="mt-7 rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="font-semibold">Already signed in</p><p className="mt-2 text-sm text-slate-700">Use your workspace or sign out to register another account.</p><div className="mt-4 flex gap-3"><Link className="button-secondary" href="/app">My workspace</Link><form action={logout}><button className="button-ghost">Sign out</button></form></div></div> : memberNeedsLink ? <p className="alert-error mt-7" role="alert">Ask an administrator for the correct join link.</p> : invalidLink ? <p className="alert-error mt-7" role="alert">This link is invalid. Ask for a new one.</p> : <><p className="mt-5 text-sm font-medium text-emerald-800">{token ? `Registering as ${copy.label.toLowerCase()}.` : "Starting a new organization."}</p><SignupForm nextPath={nextPath} accountLabel={copy.label} accountType={role} /></>}
    <p className="mt-6 text-center text-sm text-slate-600">Already have an account? <Link className="link-button" href={{ pathname: "/login", query: { next: nextPath } }}>Sign in</Link></p>
  </section></main>;
}
