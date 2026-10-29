import { describe, expect, it } from "vitest";
import { normalizeOrganizationWebsite } from "./website";

describe("normalizeOrganizationWebsite", () => {
  it.each([
    ["example.com", "https://example.com"],
    ["www.example.com", "https://www.example.com"],
    ["https://example.com/about", "https://example.com/about"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeOrganizationWebsite(input)).toBe(expected);
  });

  it.each([
    "",
    "example-company",
    "localhost",
    "ftp://example.com",
    "https://user:pass@example.com",
    "https://-example.com",
    "https://example-.com",
    "https://example.123",
    "https://example.com:8080",
    "https://example.com/a path",
  ])(
    "rejects %s",
    (input) => expect(normalizeOrganizationWebsite(input)).toBeNull(),
  );
});

