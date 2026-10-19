import { describe, expect, it } from "vitest";
import { matchesInventoryQuery, summarizeHeadcount } from "./inventory";

const visit = {
  visitReference: "VIS-2026-000184",
  visitorName: "Ada Visitor",
  hostName: "Chidi Host",
  purpose: "Project meeting",
};

describe("admin inventory search", () => {
  it.each(["vis-2026", "ADA", "chidi", "project"])("matches %s across visible fields", (query) => {
    expect(matchesInventoryQuery(visit, query)).toBe(true);
  });

  it("treats an empty query as unfiltered", () => expect(matchesInventoryQuery(visit, "  ")).toBe(true));
  it("rejects an unrelated query", () => expect(matchesInventoryQuery(visit, "delivery")).toBe(false));
});

describe("admin inventory headcount", () => {
  it("counts people rather than only visit rows", () => {
    expect(summarizeHeadcount([
      { status: "expected", groupSize: 3 },
      { status: "inside", groupSize: 4 },
      { status: "inside", groupSize: 2 },
      { status: "left", groupSize: 1 },
    ])).toEqual({ expected: 3, inside: 6, left: 1 });
  });
});
