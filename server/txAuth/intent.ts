/**
 * Phase 1 — Canonical intent serialization + commitment.
 * Deterministic JSON key order. No branch keyed on settlement_rail type.
 * destination is coerced to OpaqueDestination string — never parsed.
 */
import { sha256 } from "../services/crypto.js";
import {
  asOpaqueDestination,
  type IntentCommitment,
  type TransactionIntent,
} from "./types.js";

const INTENT_KEYS = [
  "merchant_identifier",
  "order_reference",
  "amount",
  "currency",
  "settlement_rail",
  "settlement_destination",
  "nonce",
  "timestamp",
] as const;

export function canonicalizeIntent(intent: TransactionIntent): string {
  const ordered: Record<string, string | number> = {};
  for (const k of INTENT_KEYS) {
    const v = intent[k];
    if (v === undefined || v === null || v === "") {
      throw new Error(`malformed_commitment: missing ${k}`);
    }
    if (k === "amount") {
      if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) {
        throw new Error("malformed_commitment: amount must be a positive number");
      }
      ordered[k] = Number(v.toFixed(8));
    } else if (k === "timestamp") {
      ordered[k] = Number(v);
    } else if (k === "settlement_destination") {
      // Enforce opacity at the type boundary — still a plain string in the hash
      ordered[k] = asOpaqueDestination(String(v));
    } else {
      // settlement_rail is hashed as an opaque string — never special-cased
      ordered[k] = String(v).trim();
    }
  }
  return JSON.stringify(ordered);
}

export function commitIntent(intent: TransactionIntent): IntentCommitment {
  const canonical_payload = canonicalizeIntent(intent);
  const intent_commitment = sha256(`a26z:txintent:v1:${canonical_payload}`);
  return { intent_commitment, canonical_payload };
}

export function assertIntentMatchesCommitment(
  intent: TransactionIntent,
  intentCommitment: string
): boolean {
  try {
    return commitIntent(intent).intent_commitment === intentCommitment;
  } catch {
    return false;
  }
}
