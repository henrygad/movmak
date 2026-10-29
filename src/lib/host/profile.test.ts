import { describe, expect, it } from "vitest";
import { validateHostProfile } from "./profile";

describe("host profile validation", () => {
  it("accepts complete host details", () => {
    expect(validateHostProfile("Ada Host", "+2348000000000", "Flat 2, 10 Lagos Street")).toBeNull();
  });

  it("rejects missing or invalid fields", () => {
    expect(validateHostProfile(" ", "", "")).not.toBeNull();
    expect(validateHostProfile("Ada Host", "1", "Flat 2, 10 Lagos Street")).not.toBeNull();
    expect(validateHostProfile("Ada Host", "+2348000000000", "A")).not.toBeNull();
  });
});
