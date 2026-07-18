/**
 * Phase 10 — Receiving-payment strategy schemas.
 * JIT destinations · order_ref reconciliation · settlement confirmation · credit circuit.
 */

export const RECEIVE_SKILL = "receiving-payment";
export const RECEIVE_VERSION = "1.0.0";
export const CREDIT_CIRCUIT = "prove_credit_update";

export type DestinationStatus =
  | "minted"
  | "inbound_detected"
  | "reconciled"
  | "confirmed"
  | "credited";

/** Just-in-time destination — never reused across two transactions */
export type MintedDestination = {
  destination_id: string;
  settlement_destination: string;
  order_reference: string;
  intent_commitment: string;
  merchant_identifier: string;
  amount: number;
  currency: string;
  settlement_rail: string;
  minted_at: number;
  status: DestinationStatus;
  /** Burned at mint — prevents reuse */
  destination_spent: true;
};

export type InboundObservation = {
  observation_id: string;
  destination_id: string;
  order_reference: string;
  intent_commitment: string;
  payment_ref: string;
  amount: number;
  currency: string;
  observed_at: number;
};

export type SettlementConfirmation = {
  confirmation_id: string;
  intent_commitment: string;
  order_reference: string;
  merchant_identifier: string;
  destination_id: string;
  confirmation_signature: string;
  confirmed_at: number;
};

export type CreditAttestation = {
  circuit: typeof CREDIT_CIRCUIT;
  old_balance_commitment: string;
  new_balance_commitment: string;
  inbound_proof_digest: string;
  compact_ok: boolean;
  proved: boolean;
  snark_digest?: string;
  grade: string;
};

export type ReceiveFailureReason =
  | "missing_required_fields"
  | "merchant_not_found"
  | "destination_reuse_attempt"
  | "order_not_found"
  | "amount_mismatch"
  | "already_reconciled"
  | "not_reconciled"
  | "confirmation_invalid"
  | "already_confirmed"
  | "credit_failed"
  | "intent_commitment_mismatch"
  | "unmatched_inbound";

/** Phase 5 — inbound with no matching signed intent (flagged, never silently accepted) */
export type UnmatchedInbound = {
  unmatched_id: string;
  payment_ref: string;
  settlement_destination?: string;
  order_reference?: string;
  amount: number;
  currency?: string;
  reason: "no_signed_intent" | "amount_mismatch" | "destination_mismatch" | "duplicate_attempt";
  flagged_at: number;
  detail?: string;
};

export type ReceivePayState = {
  destinations: MintedDestination[];
  /** All settlement_destination strings ever minted — reuse forbidden */
  spent_destinations: string[];
  observations: InboundObservation[];
  confirmations: SettlementConfirmation[];
  unmatched: UnmatchedInbound[];
  by_order_ref: Record<string, string>; // order_reference → destination_id
};
