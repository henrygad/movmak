import { describe, expect, it } from "vitest";
import { cameraErrorMessage } from "./camera-error";

describe("camera scanner errors", () => {
  it("explains permission and secure-context failures", () => {
    expect(cameraErrorMessage("permission-denied")).toContain("allow Camera");
    expect(cameraErrorMessage("insecure-context")).toContain("http://localhost:3000");
  });

  it("provides recovery for unavailable cameras", () => {
    expect(cameraErrorMessage("no-camera")).toContain("manual QR fallback");
    expect(cameraErrorMessage("in-use")).toContain("another app");
  });
});
