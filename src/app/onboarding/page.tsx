import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/dal";
import { OnboardingForm } from "./onboarding-form";
import { logout } from "@/app/login/actions";

export default async function OnboardingPage() {
  const context = await requireUser();
  if (context.kind === "active") redirect("/app");
  if (context.kind === "inactive") redirect("/access-inactive");

  return (
    <main className="page-shell">
      <section className="card w-full max-w-lg" aria-labelledby="onboarding-title">
        <p className="eyebrow">Organization setup</p>
        <h1 id="onboarding-title" className="title">Create your organization</h1>
        <p className="copy">You will become its first administrator. This action is recorded for accountability.</p>
        <OnboardingForm />
        <form action={logout} className="mt-6 text-center"><button className="link-button" type="submit">Sign out</button></form>
      </section>
    </main>
  );
}
