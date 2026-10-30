import Image from "next/image";
import Link from "next/link";
import { requireActiveMembership } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import type { DatabaseWithPendingOnboarding } from "@/types/pending-database.types";
import { MemberForm } from "./member-form";
import { JoinLinkActions, JoinLinkForm } from "./join-link-form";
import { RequestReviewForm } from "./request-review-form";

export default async function InvitationsPage() {
  const context = await requireActiveMembership(["admin"]);
  const supabase = await createClient<DatabaseWithPendingOnboarding>();
  const [
    { data: memberships, error: memberError },
    { data: access, error: accessError },
    { data: requestDetails, error: requestDetailError },
  ] = await Promise.all([
    supabase
      .from("organization_memberships")
      .select("id, user_id, role, status, created_at, location_verified_at, location_verified_by_membership_id, approved_at, approved_by_membership_id")
      .eq("organization_id", context.organization.id)
      .order("created_at"),
    supabase.rpc("list_organization_join_access"),
    supabase.rpc("get_pending_member_review_details"),
  ]);
  if (memberError || accessError || requestDetailError) throw new Error("Unable to load organization access.");

  const userIds = memberships.map((member) => member.user_id);
  const { data: profiles, error: profileError } = userIds.length
    ? await supabase.from("user_profiles").select("user_id, full_name").in("user_id", userIds)
    : { data: [], error: null };
  if (profileError) throw new Error("Unable to load organization users.");

  const names = new Map(profiles.map((profile) => [profile.user_id, profile.full_name]));
  const memberNames = new Map(memberships.map((member) => [member.id, names.get(member.user_id) ?? "Organization user"]));
  const detailsByRequest = new Map(requestDetails.map((detail) => [detail.request_id, detail]));
  const requestPhotoEntries = await Promise.all(requestDetails.map(async (detail) => {
    if (!detail.profile_photo_path) return [detail.request_id, null] as const;
    const { data } = await supabase.storage.from("member-profile-photos").createSignedUrl(detail.profile_photo_path, 900);
    return [detail.request_id, data?.signedUrl ?? null] as const;
  }));
  const requestPhotos = new Map(requestPhotoEntries);
  const links = access.filter((record) => record.record_type === "link");
  const requests = access.filter((record) => record.record_type === "request" && record.status === "pending");
  const formatTime = (value: string) => new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: context.organization.timezone,
  }).format(new Date(value));

  return (
    <main className="content-shell">
      <section className="card">
        <p className="eyebrow">Authorized access</p>
        <h1 className="title">Members and join links</h1>
        <p className="copy">Share a secure role-specific link. New members remain blocked until an administrator approves them.</p>
        <JoinLinkForm />
      </section>

      <section className="card mt-6">
        <h2 className="section-heading">Active join links</h2>
        <div className="mt-5 grid gap-3">
          {links.map((link) => (
            <article className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center" key={link.record_id}>
              <div>
                <p className="font-semibold capitalize">{link.role} access</p>
                <p className="mt-1 text-sm text-slate-500">
                  <span className={`status-badge status-${link.status}`}>{link.status}</span>
                  {link.expires_at ? ` · Expires ${formatTime(link.expires_at)}` : ""}
                </p>
              </div>
              {link.status === "active" ? <JoinLinkActions id={link.record_id} /> : null}
            </article>
          ))}
          {!links.length ? <p className="text-slate-600">No join links have been created.</p> : null}
        </div>
      </section>

      <section className="card mt-6">
        <h2 className="section-heading">Pending members</h2>
        <p className="copy">Review the submitted profile and verification status before granting access.</p>
        <div className="mt-5 grid gap-4">
          {requests.map((request) => {
            const details = detailsByRequest.get(request.record_id);
            const hasIdentity = Boolean(details?.full_name?.trim() && details.phone?.trim());
            const hostReady = request.role !== "host" || Boolean(details?.address?.trim() && details.occupancy_type && details.location_verified_at);
            const approvalDisabled = !hasIdentity || !hostReady;
            const approvalDisabledReason = !hasIdentity
              ? "The member must add a full name and phone number."
              : !hostReady
                ? "Security must verify the host's address and landlord or tenant status."
                : undefined;

            return (
              <article className="rounded-xl border border-amber-200 bg-amber-50/50 p-4" key={request.record_id}>
                <div className="mb-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      {requestPhotos.get(request.record_id) ? <Image unoptimized src={requestPhotos.get(request.record_id) ?? ""} alt="Member profile" width={40} height={40} className="size-10 rounded-full object-cover" /> : null}
                      <p className="font-semibold">{details?.full_name ?? request.display_name}</p>
                    </div>
                    <span className={`status-badge ${approvalDisabled ? "status-expected" : "status-active"}`}>
                      {approvalDisabled ? "Needs action" : "Ready for review"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    Requested <span className="font-semibold capitalize">{request.role}</span> · {request.email_verified ? "Email verified" : "Email not verified"} · {formatTime(request.created_at)}
                  </p>
                  <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                    <Detail label="Phone" value={details?.phone ?? "Not provided"} />
                    {request.role === "host" ? <Detail label="House or unit" value={details?.address ?? "Not provided"} /> : null}
                    {request.role === "host" ? <Detail label="Occupancy" value={details?.occupancy_type ? capitalize(details.occupancy_type) : "Not provided"} /> : null}
                    {request.role === "host" ? <Detail label="Location verification" value={details?.location_verified_at ? `Verified by ${details.location_verified_by_name ?? "security"}` : "Not verified"} /> : null}
                  </dl>
                </div>
                <RequestReviewForm
                  id={request.record_id}
                  role={request.role}
                  approvalDisabled={approvalDisabled}
                  approvalDisabledReason={approvalDisabledReason}
                />
              </article>
            );
          })}
          {!requests.length ? <p className="text-slate-600">No membership requests are waiting for review.</p> : null}
        </div>
      </section>

      <section className="card mt-6">
        <h2 className="section-heading">Organization members</h2>
        <div className="mt-5 grid gap-4">
          {memberships.map((member) => (
            <article className="rounded-xl border border-slate-200 p-4" key={member.id}>
              <div className="mb-4">
                <p className="font-semibold">{names.get(member.user_id) ?? "Organization user"}</p>
                <p className="text-sm capitalize text-slate-500">{member.role} · {member.status}</p>
                {member.role === "host" && member.location_verified_at ? (
                  <p className="mt-2 text-xs text-slate-600">Location verified by {memberNames.get(member.location_verified_by_membership_id ?? "") ?? "security"}.</p>
                ) : null}
                {member.approved_at ? (
                  <p className="mt-1 text-xs text-slate-600">Approved by {memberNames.get(member.approved_by_membership_id ?? "") ?? "an administrator"}.</p>
                ) : null}
              </div>
              <MemberForm id={member.id} role={member.role} status={member.status} disabled={member.user_id === context.user.id} />
            </article>
          ))}
        </div>
        <p className="mt-6"><Link className="link-button" href="/app/admin">Back to administrator dashboard</Link></p>
      </section>
    </main>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><dt className="font-semibold text-slate-500">{label}</dt><dd className="mt-0.5 text-slate-900">{value}</dd></div>;
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
