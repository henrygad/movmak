"use client";

import { useRouter } from "next/navigation";
import type { KeyboardEvent } from "react";
import type { AdminVisit } from "@/lib/admin/visits";

export function VisitorInventoryTable({ visits, timezone }: { visits: AdminVisit[]; timezone: string }) {
  const router = useRouter();
  const format = (value: string | null) => value
    ? new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: timezone }).format(new Date(value))
    : "Not recorded";
  const open = (visitId: string) => router.push(`/app/admin/visits/${visitId}`);
  const onKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, visitId: string) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      open(visitId);
    }
  };

  return (
    <section className="mt-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
      <table className="w-full min-w-4xl text-left text-sm">
        <thead className="bg-slate-100 text-slate-700"><tr><th className="p-4">Visit</th><th className="p-4">Visitor</th><th className="p-4">Host</th><th className="p-4">Purpose</th><th className="p-4">Companions</th><th className="p-4">Status</th><th className="p-4">Registered</th></tr></thead>
        <tbody>
          {visits.map((visit) => (
            <tr
              aria-label={`Open visit ${visit.visit_reference}`}
              className="cursor-pointer border-t border-slate-200 transition hover:bg-emerald-50 focus:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-emerald-600"
              key={visit.id}
              role="link"
              tabIndex={0}
              onClick={() => open(visit.id)}
              onKeyDown={(event) => onKeyDown(event, visit.id)}
            >
              <td className="p-4 font-semibold text-emerald-800">{visit.visit_reference}</td>
              <td className="p-4">{visit.visitorName}<span className="block text-xs text-slate-500">{visit.visitorPhone ?? "Phone not provided"}</span></td>
              <td className="p-4">{visit.hostName}</td>
              <td className="max-w-xs p-4">{visit.purpose}</td>
              <td className="p-4">{Math.max(0, visit.group_size - 1)} <span className="block text-xs text-slate-500">{visit.group_size} total</span></td>
              <td className="p-4"><span className={`status-badge status-${visit.status}`}>{visit.status}</span></td>
              <td className="p-4">{format(visit.registered_at)}</td>
            </tr>
          ))}
          {!visits.length ? <tr><td className="p-8 text-center text-slate-600" colSpan={7}>No visits match these filters.</td></tr> : null}
        </tbody>
      </table>
    </section>
  );
}
