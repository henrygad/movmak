import { redirect } from "next/navigation";
import { LoginForm } from "./login-form";
import { getAccessContext } from "@/lib/auth/dal";
import { safeNextPath } from "@/lib/auth/access";
import Link from "next/link";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const context = await getAccessContext();
  if (context.kind !== "unauthenticated") redirect("/app");
  const params = await searchParams;

  return (
    <main className="page-shell">
      <section className="card w-full max-w-md" aria-labelledby="login-title">
        <div className="wordmark"><span className="wordmark-mark">M</span><span>Movmak</span></div>
        <p className="eyebrow mt-8">Sign in</p>
        <h1 id="login-title" className="title">Welcome back</h1>
        <p className="copy">Use your Movmak email and password. We will open the correct workspace.</p>
        <LoginForm nextPath={safeNextPath(params.next ?? null)} />
        <p className="mt-6 text-center text-sm text-slate-600">Need an account? <Link className="link-button" href={{ pathname: "/signup", query: { next: safeNextPath(params.next ?? null) } }}>Register</Link></p>
      </section>
    </main>
  );
}
