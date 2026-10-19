import Link from "next/link";
import { redirect } from "next/navigation";
import { getAccessContext } from "@/lib/auth/dal";
import { SignupForm } from "./signup-form";
import { safeNextPath } from "@/lib/auth/access";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const context = await getAccessContext();
  if (context.kind !== "unauthenticated") redirect("/app");
  const next = safeNextPath((await searchParams).next ?? null);
  return <main className="page-shell"><section className="card w-full max-w-md"><div className="wordmark"><span className="wordmark-mark">M</span><span>Movmak</span></div><p className="eyebrow mt-8">Get started</p><h1 className="title">Create your account</h1><p className="copy">Confirm your email, then create an organization or request access through a join link.</p><SignupForm nextPath={next} /><p className="mt-6 text-center text-sm text-slate-600">Already registered? <Link className="link-button" href={{ pathname: "/login", query: { next } }}>Sign in</Link></p></section></main>;
}
