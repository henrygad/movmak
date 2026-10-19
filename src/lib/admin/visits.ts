import "server-only";

import { requireActiveMembership } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";
import { matchesInventoryQuery } from "@/lib/admin/inventory";

type VisitStatus = Database["public"]["Enums"]["visit_status"];
type VisitRow = Database["public"]["Tables"]["visits"]["Row"];

export type AdminVisit = VisitRow & { visitorName: string; visitorPhone: string | null; hostName: string };

export async function loadAdminVisits(filters: { status?: string; query?: string; from?: string; to?: string } = {}) {
  const context = await requireActiveMembership(["admin"]);
  const supabase = await createClient();
  let request = supabase.from("visits").select("*").eq("organization_id", context.organization.id).order("registered_at", { ascending: false }).limit(500);
  if (["expected", "inside", "left"].includes(filters.status ?? "")) request = request.eq("status", filters.status as VisitStatus);
  if (filters.from && /^\d{4}-\d{2}-\d{2}$/.test(filters.from)) request = request.gte("registered_at", `${filters.from}T00:00:00.000Z`);
  if (filters.to && /^\d{4}-\d{2}-\d{2}$/.test(filters.to)) request = request.lt("registered_at", `${filters.to}T23:59:59.999Z`);
  const { data: visits, error } = await request;
  if (error) throw new Error("Unable to load visitor inventory.");
  if (!visits.length) return { context, visits: [] as AdminVisit[] };

  const visitorIds = [...new Set(visits.map((visit) => visit.visitor_id))];
  const hostIds = [...new Set(visits.map((visit) => visit.host_membership_id))];
  const [{ data: visitors, error: visitorError }, { data: hosts, error: hostError }] = await Promise.all([
    supabase.from("visitors").select("id, full_name, phone").eq("organization_id", context.organization.id).in("id", visitorIds),
    supabase.from("organization_memberships").select("id, user_id").eq("organization_id", context.organization.id).in("id", hostIds),
  ]);
  if (visitorError || hostError) throw new Error("Unable to load visitor inventory details.");
  const userIds = hosts.map((host) => host.user_id);
  const { data: profiles, error: profileError } = userIds.length
    ? await supabase.from("user_profiles").select("user_id, full_name").in("user_id", userIds)
    : { data: [], error: null };
  if (profileError) throw new Error("Unable to load host names.");

  const visitorMap = new Map(visitors.map((visitor) => [visitor.id, visitor]));
  const profileMap = new Map(profiles.map((profile) => [profile.user_id, profile.full_name]));
  const hostMap = new Map(hosts.map((host) => [host.id, profileMap.get(host.user_id) ?? "Organization host"]));
  const rows = visits.map((visit) => ({
    ...visit,
    visitorName: visitorMap.get(visit.visitor_id)?.full_name ?? "Unknown visitor",
    visitorPhone: visitorMap.get(visit.visitor_id)?.phone ?? null,
    hostName: hostMap.get(visit.host_membership_id) ?? "Organization host",
  }));
  return {
    context,
    visits: rows.filter((visit) => matchesInventoryQuery({
      visitReference: visit.visit_reference,
      visitorName: visit.visitorName,
      hostName: visit.hostName,
      purpose: visit.purpose,
    }, filters.query)),
  };
}
