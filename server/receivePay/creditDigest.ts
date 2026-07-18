/**
 * Phase 7 — Bind credit proof to the authorized intent_commitment.
 * Digest is what Compact receives as inbound_proof_digest.
 */
import { sha256 } from "../services/crypto.js";

export function creditInboundDigest(input: {
  intent_commitment: string;
  settlement_destination: string;
  amount: number;
}): string {
  return sha256(
    `inbound:${input.intent_commitment}|${input.settlement_destination}|${input.amount}`
  );
}

/** Wrong intent must produce a different digest (exit criterion helper) */
export function assertCreditBoundToIntent(
  intent_commitment: string,
  digest: string,
  settlement_destination: string,
  amount: number
): boolean {
  return (
    creditInboundDigest({ intent_commitment, settlement_destination, amount }) === digest
  );
}
