/**
 * Rail-agnostic transaction authorization — canonical schemas (Phases 1–2).
 * Authorization binds merchant identity to a transaction intent commitment,
 * independent of settlement destination ownership.
 */

export const TX_AUTH_SKILL = "rail-agnostic-tx-auth";
export const TX_AUTH_VERSION = "1.0.0";
export const TX_AUTH_CIRCUIT = "prove_authorized_transaction";

export type MerchantStatus = "active" | "suspended" | "revoked";

/** Phase 1.1 — Merchant Identity Model */
export type MerchantIdentity = {
  merchant_identifier: string;
  merchant_public_key: string;
  /** Demo signing material — never returned via public APIs */
  merchant_secret: string;
  credential_metadata: {
    display_name: string;
    brand_id: string;
    enrolled_at: number;
    credential_version: number;
  };
  revocation_nullifier: string;
  status: MerchantStatus;
  leaf: string;
};

/** Phase 1.2 — Registry outputs */
export type RegistrySnapshot = {
  brand_registry_root: string;
  registry_version: number;
  merchant_count: number;
  updated_at: number;
  metadata: {
    name: string;
    provider: string;
    circuit: string;
  };
};

/**
 * Opaque destination — type-enforced: circuit/registry must treat this as a
 * plain string. Rail adapters may mint rail-shaped strings; the proof layer
 * never branches on rail or parses destination structure.
 */
declare const opaqueDestinationBrand: unique symbol;
export type OpaqueDestination = string & { readonly [opaqueDestinationBrand]?: true };

export function asOpaqueDestination(value: string): OpaqueDestination {
  const s = String(value ?? "").trim();
  if (!s) throw new Error("malformed_commitment: empty settlement_destination");
  return s as OpaqueDestination;
}

/** Phase 1 — Canonical transaction intent (rail-agnostic) */
export type TransactionIntent = {
  merchant_identifier: string;
  order_reference: string;
  amount: number;
  currency: string;
  /** Opaque rail id — included in commitment, never special-cased in hash logic */
  settlement_rail: string;
  /** OpaqueDestination — never parsed by circuit */
  settlement_destination: OpaqueDestination | string;
  nonce: string;
  timestamp: number;
};

/** Buyer-side states (Phase 6) — distinguishable from confirmations alone */
export type BuyerPaymentState =
  | "payment_sent"
  | "payment_received_and_matched"
  | "payment_sent_not_yet_matched";

export type IntentCommitment = {
  intent_commitment: string;
  canonical_payload: string;
};

export type PlatformChallenge = {
  challenge_id: string;
  platform_challenge: string;
  agent_session_id: string;
  time_window: string;
  issued_at: number;
  expires_at: number;
  intent_commitment: string;
};

export type MerchantAuthorization = {
  intent_signature: string;
  merchant_identifier: string;
  intent_commitment: string;
  signed_at: number;
};

export type AuthorizedTxProof = {
  circuit: typeof TX_AUTH_CIRCUIT;
  /** Binding digest (always verified) */
  proof: string;
  /** Real proof-server SNARK digest when Compact+/prove succeeded */
  snark_digest?: string;
  public_inputs: {
    brand_registry_root: string;
    platform_challenge: string;
    intent_commitment: string;
  };
  leaf: string;
  nullifier: string;
  intent_signature: string;
  generated_at: number;
};

export type VerifyFailureReason =
  | "missing_required_fields"
  | "merchant_not_found"
  | "membership_proof_invalid"
  | "authorization_signature_invalid"
  | "nullifier_revoked"
  | "challenge_mismatch_or_expired"
  | "intent_commitment_mismatch"
  | "registry_inconsistency"
  | "malformed_commitment"
  | "proof_invalid"
  | "expired_proof"
  | "policy_rejected";

export type VerificationResult =
  | {
      authorized: true;
      merchant_identifier: string;
      intent_commitment: string;
      proof_challenge_id: string;
      verified_at: string;
      registry_version: number;
      settlement_rail: string;
      private_information_exposed: false;
      checks: {
        membership: true;
        authorization_signature: true;
        not_revoked: true;
        challenge_fresh: true;
        intent_bound: true;
      };
    }
  | {
      authorized: false;
      reason: VerifyFailureReason;
      detail?: string;
      private_information_exposed: false;
    };

export type SettlementRequest = {
  intent: TransactionIntent;
  intent_commitment: string;
  verification: Extract<VerificationResult, { authorized: true }>;
  proof_challenge_id: string;
};

export type SettlementReceipt = {
  ok: boolean;
  rail: string;
  settlement_id: string;
  routed_at: string;
  note: string;
};
