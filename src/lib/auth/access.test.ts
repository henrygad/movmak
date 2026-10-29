import { describe, expect, it } from "vitest";
import {
  resolveMembershipAccess,
  roleCanAccess,
  safeNextPath,
  validateLoginCredentials,
  validateOrganizationName,
  type MembershipSummary,
} from "./access";

const membership = (
  status: MembershipSummary["status"],
  role: MembershipSummary["role"] = "host",
): MembershipSummary => ({
  id: `${status}-${role}`,
  organizationId: "organization-id",
  role,
  status,
});

describe("validateLoginCredentials", () => {
  it("accepts a plausible email and password", () => {
    expect(validateLoginCredentials("user@example.com", "password-value")).toBeNull();
  });

  it("rejects malformed credentials without revealing which account exists", () => {
    expect(validateLoginCredentials("not-an-email", "password-value")).toBe(
      "Enter a valid email address.",
    );
    expect(validateLoginCredentials("user@example.com", "short")).toBe(
      "Enter your password.",
    );
  });
});

describe("validateOrganizationName", () => {
  it("accepts an organization name", () => {
    expect(validateOrganizationName("Example Company")).toBeNull();
  });

  it.each(["", "A", "A".repeat(161)])(
    "rejects invalid name %s",
    (name) => {
      expect(validateOrganizationName(name)).not.toBeNull();
    },
  );
});

describe("resolveMembershipAccess", () => {
  it("requires onboarding when no membership exists", () => {
    expect(resolveMembershipAccess([])).toEqual({ kind: "no_membership" });
  });

  it.each(["suspended", "revoked"] as const)(
    "denies an account with only a %s membership",
    (status) => {
      expect(resolveMembershipAccess([membership(status)]).kind).toBe(
        "inactive",
      );
    },
  );

  it("uses an active membership instead of an inactive one", () => {
    const active = membership("active", "security");
    expect(
      resolveMembershipAccess([membership("revoked"), active]),
    ).toEqual({ kind: "active", membership: active });
  });
});

describe("roleCanAccess", () => {
  it("permits only explicitly allowed roles", () => {
    expect(roleCanAccess("admin", ["admin"])).toBe(true);
    expect(roleCanAccess("host", ["admin"])).toBe(false);
    expect(roleCanAccess("security", ["security"])).toBe(true);
    expect(roleCanAccess("host", ["host"])).toBe(true);
    expect(roleCanAccess("admin", ["host"])).toBe(false);
    expect(roleCanAccess("security", ["host"])).toBe(false);
  });
});

describe("safeNextPath", () => {
  it("accepts an internal path", () => {
    expect(safeNextPath("/app/security")).toBe("/app/security");
  });

  it.each([null, "", "https://example.com", "//example.com"])(
    "rejects unsafe redirect value %s",
    (value) => {
      expect(safeNextPath(value)).toBe("/app");
    },
  );
});
