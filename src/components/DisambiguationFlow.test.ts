import { describe, expect, it } from "vitest";
import {
  orderResolutionCandidates,
  resolutionState,
  type ResolutionCandidate,
} from "./DisambiguationFlow";
import type { RecipientVerification } from "../lib/api";

const candidate = (
  id: string,
  hintStrength: number,
  responded = true
): ResolutionCandidate => ({
  id,
  displayName: "Deepa",
  handle: `deepa.${id}`,
  asset: "INR",
  jurisdiction: "IN",
  kycStatus: "sandbox_verified",
  sanctionsStatus: "clear",
  maskedId: `${id}…`,
  verified: true,
  hintStrength,
  responded,
});

const result = (
  status: RecipientVerification["status"],
  matches: ResolutionCandidate[]
): RecipientVerification => ({
  ok: true,
  recipient: "Deepa",
  status,
  basis: status === "ambiguous" ? "kyc_ambiguous" : status === "verified" ? "kyc_sandbox" : "none",
  label: "Deepa",
  detail: "resolution",
  matches,
});

describe("identity resolution state matrix", () => {
  it("refuses zero candidates without guessing", () => {
    expect(resolutionState(result("unverified", []))).toBe("no-match");
  });

  it("silently passes through one verified match", () => {
    expect(resolutionState(result("verified", [candidate("one", 1)]))).toBe("silent");
  });

  it("shows two or more responding candidates", () => {
    expect(resolutionState(result("ambiguous", [candidate("a", 1), candidate("b", 2)]))).toBe("candidates");
  });

  it("omits non-responders and orders by strongest hint", () => {
    expect(
      orderResolutionCandidates([
        candidate("weak", 1),
        candidate("silent", 10, false),
        candidate("strong", 5),
      ]).map(({ id }) => id)
    ).toEqual(["strong", "weak"]);
  });

  it("refuses when all candidates remain silent", () => {
    expect(resolutionState(result("ambiguous", [candidate("a", 1, false)]))).toBe("no-match");
  });

  it("offers proximity when no safe list remains and proximity is available", () => {
    expect(resolutionState(result("unverified", []), true)).toBe("proximity");
  });
});