import { describe, expect, it } from "vitest";
import { sealVisitQr, unsealVisitQr, type StoredVisitQr } from "./visit-qr-cookie";

const secret = "a-test-only-server-key-that-is-longer-than-32-characters";
const value: StoredVisitQr = {
  invitationHash: `\\x${"a".repeat(64)}`,
  qrPayload: `movmak:visit:v1:${"b".repeat(43)}`,
  visitReference: "VIS-2026-000184",
};

describe("encrypted saved visit QR", () => {
  it("restores a valid QR without storing it in plaintext", () => {
    const sealed = sealVisitQr(value, secret);
    expect(sealed).not.toContain(value.qrPayload);
    expect(unsealVisitQr(sealed, secret)).toEqual(value);
  });

  it("rejects tampered cookies and the wrong key", () => {
    const sealed = sealVisitQr(value, secret);
    expect(unsealVisitQr(`${sealed[0] === "A" ? "B" : "A"}${sealed.slice(1)}`, secret)).toBeNull();
    expect(unsealVisitQr(sealed, `${secret}-different`)).toBeNull();
  });
});
