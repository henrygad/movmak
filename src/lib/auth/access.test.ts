import { describe, expect, it } from "vitest";
import {
  resolveMembershipAccess,
  roleCanAccess,
  safeNextPath,
  validateLoginCredentials,
  validateOrganizationInput,
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

describe("validateOrganizationInput", () => {
  it("accepts a normalized organization name and slug", () => {
    expect(validateOrganizationInput("Example Company", "example-company")).toBeNull();
  });

  it.each(["Example", "example--company", "-example", "example-"])(
    "rejects unsafe slug %s",
    (slug) => {
      expect(validateOrganizationInput("Example Company", slug)).not.toBeNull();
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
