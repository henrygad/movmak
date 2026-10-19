import { describe, expect, it } from "vitest";
import { isMembershipStatus } from "./members";

describe("membership management input", () => {
  it.each(["active", "suspended", "revoked"])("accepts %s", (value) => expect(isMembershipStatus(value)).toBe(true));
  it.each(["", "deleted", "ADMIN", "active "])("rejects %s", (value) => expect(isMembershipStatus(value)).toBe(false));
});
