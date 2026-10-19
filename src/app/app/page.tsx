import Link from "next/link";
import { requireActiveMembership } from "@/lib/auth/dal";

const roleDestinations = { admin: "/app/admin", host: "/app/host", security: "/app/security" } as const;

export default async function AppHome({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const context = await requireActiveMembership();
  const params = await searchParams;
  return (
    <main className="content-shell">
      {params.error === "forbidden" ? <p className="alert-error" role="alert">Your role does not permit access to that area.</p> : null}
      <section className="card">
        <p className="eyebrow">Secure organization access</p>
        <h1 className="title">{context.organization.name}</h1>
        <p className="copy">You are signed in with an active <span className="font-semibold capitalize">{context.membership.role}</span> membership.</p>
        <Link className="button-primary mt-8 inline-flex" href={roleDestinations[context.membership.role]}>Continue to your workspace</Link>
      </section>
    </main>
  );
}
