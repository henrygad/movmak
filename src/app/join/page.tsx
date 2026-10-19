import { JoinForm } from "./join-form";

export default async function JoinPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  return <main className="page-shell"><section className="card w-full max-w-lg"><p className="eyebrow">Organization access</p><h1 className="title">Request to join</h1><p className="copy">Sign in with a verified email, then request access. You will not see organization data until an administrator approves you.</p><JoinForm token={token} /></section></main>;
}
