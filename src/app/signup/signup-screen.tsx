import Link from "next/link";
import { logout } from "@/app/login/actions";
import { getAccessContext } from "@/lib/auth/dal";
import { joinPath } from "@/lib/auth/signup-flow";
import type { OrganizationRole } from "@/lib/auth/access";
import { isPlausibleInvitationToken } from "@/lib/auth/invitations";
import { SignupForm } from "./signup-form";

const descriptions = {
  admin: { label: "Organization owner", title: "Create an organization account", help: "Confirm your email, then create your organization. You will become its first administrator." },
  host: { label: "Resident or worker", title: "Join as a resident or host", help: "Register with your organization's join link. Your home opens after sign in; invitations become available once an administrator approves you." },
  security: { label: "Security or reception", title: "Join the reception team", help: "Register with your organization's join link. Your gate desk opens after sign in; gate actions become available once an administrator approves you." },
} as const;

export async function SignupScreen({ role, token = "" }: { role: OrganizationRole; token?: string }) {
  const context = await getAccessContext();
  const memberNeedsLink = role !== "admin" && !token;
  const invalidLink = Boolean(token) && !isPlausibleInvitationToken(token);
  const nextPath = token && !invalidLink ? joinPath(token) : "/onboarding";
  const copy = role === "admin" && token ? { label: "Invited administrator", title: "Join as an administrator", help: "Confirm your email, then request administrator access to this organization. Your dashboard opens immediately; management actions require approval." } : descriptions[role];

  return <main className="page-shell"><section className="card w-full max-w-md"><div className="wordmark"><span className="wordmark-mark">M</span><span>Movmak</span></div><p className="eyebrow mt-8">{copy.label} registration</p><h1 className="title">{copy.title}</h1><p className="copy">{copy.help}</p>
    {context.kind !== "unauthenticated" ? <div className="mt-7 rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="font-semibold">You are already signed in</p><p className="mt-2 text-sm text-slate-700">One email has one Movmak account. Sign out before registering another person. If this is your account, use your existing workspace.</p><div className="mt-4 flex gap-3"><Link className="button-secondary" href="/app">My workspace</Link><form action={logout}><button className="button-ghost">Sign out</button></form></div></div> : memberNeedsLink ? <p className="alert-error mt-7" role="alert">Ask your organization administrator for a join link for this role before registering.</p> : invalidLink ? <p className="alert-error mt-7" role="alert">This invitation link is malformed. Ask your administrator for a new link.</p> : <><p className="mt-5 text-sm font-medium text-emerald-800">{token ? `Registering as ${copy.label.toLowerCase()}. The secure invitation decides your final organization role.` : "Starting a new organization."}</p><SignupForm nextPath={nextPath} accountLabel={copy.label} accountType={role} /></>}
    <p className="mt-6 text-center text-sm text-slate-600">Already have an account? <Link className="link-button" href={{ pathname: "/login", query: { next: nextPath } }}>Sign in</Link></p>
  </section></main>;
}
