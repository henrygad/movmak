import type { MembershipStatus } from "@/lib/auth/access";

const membershipStatuses: readonly MembershipStatus[] = ["active", "suspended", "revoked"];

export function isMembershipStatus(value: string): value is MembershipStatus {
  return membershipStatuses.includes(value as MembershipStatus);
}
