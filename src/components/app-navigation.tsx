"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { OrganizationRole } from "@/lib/auth/access";

const links = {
  admin: [
    ["Overview", "/app/admin"], ["Visitors", "/app/admin/visits"],
    ["Reports", "/app/admin/reports"], ["Audit", "/app/admin/audit"],
    ["Members", "/app/admin/invitations"], ["Settings", "/app/admin/settings"],
  ],
  host: [["Host home", "/app/host"]],
  security: [
    ["Gate home", "/app/security"], ["Scan QR", "/app/security/scan"],
    ["New visitor", "/app/security/new"], ["Currently inside", "/app/security/inside"],
  ],
} satisfies Record<OrganizationRole, readonly (readonly [string, string])[]>;

export function AppNavigation({ role }: { role: OrganizationRole }) {
  const pathname = usePathname();
  return <nav className="app-nav" aria-label={`${role} navigation`}>{links[role].map(([label, href]) => {
    const active = pathname === href;
    return <Link className="app-nav-link" data-active={active || undefined} aria-current={active ? "page" : undefined} href={href} key={href}>{label}</Link>;
  })}</nav>;
}
