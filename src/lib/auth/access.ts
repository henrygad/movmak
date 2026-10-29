import type { Database } from "@/types/database.types";

export type OrganizationRole =
  Database["public"]["Enums"]["organization_role"];
export type MembershipStatus =
  Database["public"]["Enums"]["membership_status"];

export type MembershipSummary = {
  id: string;
  organizationId: string;
  role: OrganizationRole;
  status: MembershipStatus;
};

export type MembershipAccess =
  | { kind: "no_membership" }
  | { kind: "inactive"; memberships: MembershipSummary[] }
  | { kind: "active"; membership: MembershipSummary };

export function resolveMembershipAccess(
  memberships: MembershipSummary[],
): MembershipAccess {
  const activeMembership = memberships.find(
    (membership) => membership.status === "active",
  );

  if (activeMembership) {
    return { kind: "active", membership: activeMembership };
  }

  if (memberships.length > 0) {
    return { kind: "inactive", memberships };
  }

  return { kind: "no_membership" };
}

export function roleCanAccess(
  actualRole: OrganizationRole,
  allowedRoles: readonly OrganizationRole[],
) {
  return allowedRoles.includes(actualRole);
}

export function safeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/app";
  }

  return value;
}

export function validateLoginCredentials(email: unknown, password: unknown) {
  if (typeof email !== "string" || !email.includes("@")) {
    return "Enter a valid email address.";
  }
  if (typeof password !== "string" || password.length < 8) {
    return "Enter your password.";
  }
  return null;
}

export function validateOrganizationName(name: string) {
  if (name.length < 2 || name.length > 160) {
    return "Organization name must be between 2 and 160 characters.";
  }
  return null;
}
