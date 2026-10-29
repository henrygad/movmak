import { describe, expect, it } from "vitest";
import { resolveRequestOrigin } from "@/lib/auth/request-origin";

function headerReader(values: Record<string, string> = {}) {
  const normalized = new Map(Object.entries(values).map(([key, value]) => [key.toLowerCase(), value]));
  return { get: (name: string) => normalized.get(name.toLowerCase()) ?? null };
}

describe("resolveRequestOrigin", () => {
  it("uses the current secure browser origin", () => {
    expect(resolveRequestOrigin(
      headerReader({ origin: "https://movmak.example.com" }),
      { NODE_ENV: "production" },
    )).toBe("https://movmak.example.com");
  });

  it("uses Vercel forwarded host information when Origin is absent", () => {
    expect(resolveRequestOrigin(
      headerReader({ "x-forwarded-host": "movmak.vercel.app", "x-forwarded-proto": "https" }),
      { NODE_ENV: "production" },
    )).toBe("https://movmak.vercel.app");
  });

  it("uses the current Vercel deployment URL as a production fallback", () => {
    expect(resolveRequestOrigin(
      headerReader(),
      { NODE_ENV: "production", VERCEL_URL: "movmak-preview.vercel.app" },
    )).toBe("https://movmak-preview.vercel.app");
  });

  it("never falls back to localhost in production", () => {
    expect(resolveRequestOrigin(headerReader(), { NODE_ENV: "production" })).toBeNull();
  });

  it("allows localhost only during local development", () => {
    expect(resolveRequestOrigin(headerReader(), { NODE_ENV: "development" })).toBe("http://localhost:3000");
  });

  it("rejects an insecure remote origin", () => {
    expect(resolveRequestOrigin(
      headerReader({ origin: "http://movmak.example.com" }),
      { NODE_ENV: "production" },
    )).toBeNull();
  });
});
