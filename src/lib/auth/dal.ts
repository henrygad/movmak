import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  resolveMembershipAccess,
  roleCanAccess,
  type OrganizationRole,
} from "@/lib/auth/access";

export const getAccessContext = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { kind: "unauthenticated" } as const;
  }

  const { data: memberships, error: membershipError } = await supabase
    .from("organization_memberships")
    .select("id, organization_id, role, status")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (membershipError) {
    throw new Error("Unable to verify organization access.");
  }

  const access = resolveMembershipAccess(
    memberships.map((membership) => ({
      id: membership.id,
      organizationId: membership.organization_id,
      role: membership.role,
      status: membership.status,
    })),
  );

  if (access.kind !== "active") {
    return { ...access, user };
  }

  const { data: organization, error: organizationError } = await supabase
    .from("organizations")
    .select("id, name, slug, timezone, entry_mode, logo_url")
    .eq("id", access.membership.organizationId)
    .single();

  if (organizationError || !organization) {
    throw new Error("Unable to verify the active organization.");
  }

  return { ...access, user, organization };
});

export async function requireUser() {
  const context = await getAccessContext();
  if (context.kind === "unauthenticated") redirect("/login");
  return context;
}

export async function requireActiveMembership(
  allowedRoles?: readonly OrganizationRole[],
) {
  const context = await requireUser();
  if (context.kind === "no_membership") redirect("/onboarding");
  if (context.kind === "inactive") redirect("/access-inactive");
  if (allowedRoles && !roleCanAccess(context.membership.role, allowedRoles)) {
    redirect("/app?error=forbidden");
  }
  return context;
}
