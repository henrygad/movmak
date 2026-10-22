import { describe, expect, it } from "vitest";
import { accountTypeFromMetadata, invitedSignupPath, joinPath, signupPathForRole, workspacePathForRole } from "./signup-flow";

describe("role-specific member onboarding", () => {
  it.each([
    ["admin", "/signup/admin", "/app/admin"],
    ["host", "/signup/host", "/app/host"],
    ["security", "/signup/reception", "/app/security"],
  ] as const)("routes %s to its registration and approved workspace", (role, signup, workspace) => {
    expect(signupPathForRole(role)).toBe(signup);
    expect(workspacePathForRole(role)).toBe(workspace);
  });

  it("keeps a bearer token encoded in the join URL", () => {
    expect(joinPath("A/B?C")).toBe("/join?token=A%2FB%3FC");
    expect(invitedSignupPath("host", "A/B?C")).toBe("/signup/host?token=A%2FB%3FC");
    expect(invitedSignupPath("security", "A/B?C")).toBe("/signup/reception?token=A%2FB%3FC");
  });

  it("accepts only known account types from signup metadata", () => {
    expect(accountTypeFromMetadata({ account_type: "host" })).toBe("host");
    expect(accountTypeFromMetadata({ account_type: "security" })).toBe("security");
    expect(accountTypeFromMetadata({ account_type: "owner" })).toBeNull();
    expect(accountTypeFromMetadata(null)).toBeNull();
  });
});
