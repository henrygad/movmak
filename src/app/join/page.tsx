import { JoinForm } from "./join-form";
import { redirect } from "next/navigation";
import { getAccessContext } from "@/lib/auth/dal";
import { logout } from "@/app/login/actions";
import Link from "next/link";
import { isPlausibleInvitationToken } from "@/lib/auth/invitations";
import { previewJoinLink } from "@/lib/auth/join-status";
import { invitedSignupPath } from "@/lib/auth/signup-flow";

export default async function JoinPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  const context = await getAccessContext();
  if (!isPlausibleInvitationToken(token)) return <main className="page-shell"><section className="card w-full max-w-lg"><p className="eyebrow">Organization access</p><h1 className="title">Join link unavailable</h1><p className="copy">This invitation link is malformed. Ask your administrator for a new one.</p></section></main>;
  const invitation = await previewJoinLink(token);
  if (invitation && context.kind === "unauthenticated") redirect(invitedSignupPath(invitation.requested_role, token));
  if (invitation === null) return <main className="page-shell"><section className="card w-full max-w-lg"><p className="eyebrow">Organization access</p><h1 className="title">Join link unavailable</h1><p className="copy">This invitation is invalid, expired, or revoked. Ask your administrator for a new link.</p></section></main>;
  if (context.kind === "unauthenticated") redirect(`/login?next=${encodeURIComponent(`/join?token=${token}`)}`);
  if (context.kind === "active" || context.kind === "inactive") return <main className="page-shell"><section className="card w-full max-w-lg"><p className="eyebrow">Organization access</p><h1 className="title">This account already has a membership</h1><p className="copy">One email can belong to one organization account. Open your workspace, or sign out before registering another person.</p><div className="mt-6 flex gap-3"><Link className="button-secondary" href="/app">My workspace</Link><form action={logout}><button className="button-ghost">Sign out</button></form></div></section></main>;
  return <main className="page-shell"><section className="card w-full max-w-lg"><p className="eyebrow">Organization access</p><h1 className="title">Completing your organization signup</h1><p className="copy">Movmak is validating the invitation and assigning the role stored with it. Your dashboard opens now; work actions unlock after an administrator approves your request.</p><JoinForm token={token} /></section></main>;
}
