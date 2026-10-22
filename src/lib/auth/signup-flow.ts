import type { OrganizationRole } from "@/lib/auth/access";

export function signupPathForRole(role: OrganizationRole) {
  return role === "host" ? "/signup/host" : role === "security" ? "/signup/reception" : "/signup/admin";
}

export function invitedSignupPath(role: OrganizationRole, token: string) {
  return `${signupPathForRole(role)}?token=${encodeURIComponent(token)}`;
}

export function joinPath(token: string) {
  return `/join?token=${encodeURIComponent(token)}`;
}

export function workspacePathForRole(role: OrganizationRole) {
  return role === "host" ? "/app/host" : role === "security" ? "/app/security" : "/app/admin";
}

export function accountTypeFromMetadata(metadata: unknown): OrganizationRole | null {
  if (!metadata || typeof metadata !== "object") return null;
  const accountType = (metadata as Record<string, unknown>).account_type;
  return accountType === "admin" || accountType === "host" || accountType === "security" ? accountType : null;
}
