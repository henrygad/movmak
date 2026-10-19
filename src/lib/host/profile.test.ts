import { describe, expect, it } from "vitest";
import { validateHostProfile } from "./profile";

describe("host profile validation", () => {
  it("accepts a display name and optional phone", () => {
    expect(validateHostProfile(" Ada Host ", "")).toBeNull();
    expect(validateHostProfile("Ada Host", "+2348000000000")).toBeNull();
  });

  it("rejects missing or invalid fields", () => {
    expect(validateHostProfile(" ", "")).not.toBeNull();
    expect(validateHostProfile("Ada Host", "1")).not.toBeNull();
  });
});
