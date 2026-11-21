import { requireActiveMembership } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import type { DatabaseWithPendingOnboarding } from "@/types/pending-database.types";
import { SecurityReportForm } from "./report-form";
export default async function ResidentReportsPage() {
  await requireActiveMembership(["host"]);
  const supabase = await createClient<DatabaseWithPendingOnboarding>();
  const { data: reports, error } = await supabase.rpc("list_my_security_reports");
  if (error) throw new Error("Security reports could not be loaded.");
  return <main className="content-shell"><section className="card"><p className="eyebrow">Resident safety</p><h1 className="title">Security reports</h1><p className="copy">Report a concern to your organization administrators and track its status.</p></section><SecurityReportForm /><section className="card mt-6"><h2 className="section-heading">Your reports</h2><div className="mt-5 grid gap-3">{reports.map((report) => <article className="rounded-xl border border-slate-200 p-4" key={report.report_id}><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-bold">{report.category}</p><span className="status-badge status-expected capitalize">{report.status.replace("_", " ")}</span></div><p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{report.details}</p><p className="mt-3 text-xs text-slate-500">Submitted {new Date(report.submitted_at).toLocaleString("en-NG")}</p></article>)}{!reports.length ? <p className="text-sm text-slate-600">No security reports submitted.</p> : null}</div></section></main>;
}
