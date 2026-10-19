import Link from "next/link";
import type { ReactNode } from "react";
import { requireActiveMembership } from "@/lib/auth/dal";
import { logout } from "@/app/login/actions";
import { AppNavigation } from "@/components/app-navigation";

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const context = await requireActiveMembership();
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="app-header">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-8">
          <div className="flex min-w-0 items-center gap-3"><Link href="/app" className="wordmark" aria-label="Movmak home"><span className="wordmark-mark">M</span><span>Movmak</span></Link><span className="hidden h-6 w-px bg-slate-200 sm:block" /><p className="truncate text-sm text-slate-500">{context.organization.name}</p></div>
          <div className="flex shrink-0 items-center gap-3"><span className="status-badge status-active capitalize">{context.membership.role}</span><form action={logout}><button className="button-ghost" type="submit">Sign out</button></form></div>
        </div>
        <div className="mx-auto max-w-6xl px-4 sm:px-8"><AppNavigation role={context.membership.role} /></div>
      </header>
      {children}
    </div>
  );
}
