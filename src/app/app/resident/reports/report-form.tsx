"use client";
import { useActionState } from "react";
import { submitSecurityReport, type ReportState } from "./actions";
const initial: ReportState = { error: null, message: null };
export function SecurityReportForm() {
  const [state, action, pending] = useActionState(submitSecurityReport, initial);
  return <form action={action} className="card mt-6"><h2 className="section-heading">Submit a report</h2><div className="mt-5 grid gap-4"><label className="text-sm font-semibold">Category<select className="field font-normal" name="category" defaultValue="" required><option value="" disabled>Choose one</option><option>Suspicious activity</option><option>Access concern</option><option>Safety hazard</option><option>Other security concern</option></select></label><label className="text-sm font-semibold">What happened?<textarea className="field min-h-32 font-normal" name="details" minLength={10} maxLength={2000} required /></label></div>{state.error ? <p className="alert-error mt-4" role="alert">{state.error}</p> : null}{state.message ? <p className="alert-success mt-4" role="status">{state.message}</p> : null}<button className="button-primary mt-5" disabled={pending}>{pending ? "Submitting…" : "Submit report"}</button></form>;
}
