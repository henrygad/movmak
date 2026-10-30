import Link from "next/link";
import { requireActiveMembership } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import type { DatabaseWithPendingOnboarding } from "@/types/pending-database.types";
import { LocationVerificationForm } from "./location-verification-form";

export default async function HostLocationsPage() {
  await requireActiveMembership(["security"]);
  const supabase = await createClient<DatabaseWithPendingOnboarding>();
  const { data: requests, error } = await supabase.rpc("list_pending_host_location_verifications");
  if (error) throw new Error("Unable to load host location requests.");

  return <main className="content-shell">
    <section className="card">
      <p className="eyebrow">Host approval</p>
      <h1 className="title">Verify host locations</h1>
      <p className="copy">Confirm each address in person. Correct inaccurate details before selecting Location Verify.</p>
    </section>
    <section className="mt-6 grid gap-5">
      {requests.map((request) => <article className="card" key={`${request.verification_target_type}:${request.verification_target_id}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="text-xl font-bold text-slate-950">{request.full_name ?? "Host applicant"}</h2><p className="mt-1 text-sm text-slate-600">{request.phone ?? "Phone not provided"}</p></div>
          <span className={`status-badge ${request.location_verified_at ? "status-active" : "status-expected"}`}>{request.location_verified_at ? "Verified" : "Needs verification"}</span>
        </div>
        {request.location_verified_at ? <p className="alert-success mt-5">Verified by {request.location_verified_by_name ?? "security"}.</p> : <LocationVerificationForm targetId={request.verification_target_id} targetType={request.verification_target_type} address={request.address} occupancyType={request.occupancy_type} />}
      </article>)}
      {!requests.length ? <div className="card text-center"><h2 className="text-xl font-bold">No host locations are waiting</h2><p className="copy mx-auto">New host requests will appear here before administrator approval.</p></div> : null}
    </section>
    <p className="mt-6"><Link className="link-button" href="/app/security">Back to gate desk</Link></p>
  </main>;
}
