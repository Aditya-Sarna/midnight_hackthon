/**
 * Credit-scoped identity — deliberate exception to payment unlinkability (§2 Problem B).
 *
 * credit_identity = hash(kyc_leaf, "credit-scope-salt")
 * Deterministic per KYC person; never used in payments or Circled-Auth session proofs.
 */
import { createHash } from "node:crypto";
import {
  compactBalanceCommit,
  openingToHex,
  randomOpening,
} from "../services/compactCommit.js";

const CREDIT_SCOPE_SALT = "circled:credit-scope-salt:v1";

export function deriveCreditIdentity(kycLeaf: string): string {
  const leaf = String(kycLeaf || "").trim();
  if (!leaf) throw new Error("KYC leaf required for credit_identity");
  return createHash("sha256").update(`${CREDIT_SCOPE_SALT}|${leaf}`).digest("hex");
}

/**
 * Public threshold binding for prove_credit_standing:
 * persistentCommit(threshold, opening) — circuit enforces count vs bound Field.
 */
export function encodeThresholdCommitment(n: number): {
  commitment: string;
  opening: string;
  value: number;
} {
  const value = Math.max(0, Math.floor(n));
  const opening = randomOpening();
  const commitment = compactBalanceCommit(BigInt(value), opening);
  return { commitment, opening: openingToHex(opening), value };
}

/** @deprecated use encodeThresholdCommitment — kept for hex pad tests */
export function encodeThresholdHex(n: number): string {
  return encodeThresholdCommitment(n).commitment;
}
