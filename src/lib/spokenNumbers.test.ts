import { describe, expect, it } from "vitest";
import { parseSpokenNumberPhrase, replaceSpokenNumbers } from "./spokenNumbers";

describe("parseSpokenNumberPhrase", () => {
  it("parses simple and compound English", () => {
    expect(parseSpokenNumberPhrase(["five", "hundred"])).toBe(500);
    expect(parseSpokenNumberPhrase(["twenty", "five"])).toBe(25);
    expect(parseSpokenNumberPhrase(["one", "thousand", "two", "hundred"])).toBe(1200);
  });
});

describe("replaceSpokenNumbers", () => {
  it("replaces phrases inside sentences", () => {
    expect(replaceSpokenNumbers("pay five hundred to Janhvi")).toMatch(/500/);
    expect(replaceSpokenNumbers("send twenty five dollars")).toMatch(/25/);
  });
});
