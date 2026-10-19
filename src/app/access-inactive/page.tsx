import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/dal";
import { logout } from "@/app/login/actions";

export default async function InactiveAccessPage() {
  const context = await requireUser();
  if (context.kind === "active") redirect("/app");
  if (context.kind === "no_membership") redirect("/onboarding");

  return (
    <main className="page-shell">
      <section className="card w-full max-w-lg" aria-labelledby="inactive-title">
        <p className="eyebrow">Access unavailable</p>
        <h1 id="inactive-title" className="title">Your membership is not active</h1>
        <p className="copy">Ask an organization administrator to review your access. Signing in does not override a suspended or revoked membership.</p>
        <form action={logout} className="mt-8"><button className="button-secondary" type="submit">Sign out</button></form>
      </section>
    </main>
  );
}
