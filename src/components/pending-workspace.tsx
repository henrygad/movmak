import { logout } from "@/app/login/actions";
import type { OrganizationRole } from "@/lib/auth/access";
import type { ReactNode } from "react";

type JoinRequest = {
  organization_name: string;
  request_status: string;
  requested_role: OrganizationRole;
} | null;

export function PendingWorkspace({ role, request, children }: { role: "host" | "security"; request: JoinRequest; children?: ReactNode }) {
  const isHost = role === "host";
  const rejected = request?.request_status === "rejected";
  const pending = request?.request_status === "pending";
  const organization = request?.organization_name;

  return (
    <main className="content-shell">
      <section className="card mx-auto max-w-2xl">
        <p className="eyebrow">{isHost ? "Resident / host home" : "Security and reception"}</p>
        <h1 className="title">{isHost ? "Host dashboard" : "Gate desk"}</h1>
        <p className={`mt-5 rounded-lg border p-4 font-semibold ${rejected ? "border-red-200 bg-red-50 text-red-900" : "border-amber-200 bg-amber-50 text-amber-900"}`} role="status">
          {rejected ? "Your membership request was not approved" : pending ? "Waiting for administrator approval" : "Organization request not submitted"}
        </p>
        <p className="copy">
          Your {role} account is active and you can sign in to this dashboard.
          {organization ? ` Your request to join ${organization} is ${request?.request_status}.` : " Complete registration through your organization invitation link so its administrator can review your request."}
        </p>
        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
          {isHost
            ? "Visitor invitation links and four-digit host codes will unlock after approval."
            : "QR verification, check-in, checkout, manual registration, and visitor inventory will unlock after approval."}
        </div>
        <form action={logout} className="mt-6"><button className="button-ghost" type="submit">Sign out</button></form>
      </section>
      {children ? <div className="mx-auto max-w-2xl">{children}</div> : null}
    </main>
  );
}
