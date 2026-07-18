/**
 * Agent SDK — rail-agnostic transaction authorization (Phases 7 + 11).
 * Authorizes transaction intent commitments; settlement rails are interchangeable.
 */
import { req } from "./api.js";

export type TransactionIntent = {
  merchant_identifier: string;
  order_reference: string;
  amount: number;
  currency: string;
  settlement_rail: string;
  settlement_destination: string;
  nonce: string;
  timestamp: number;
};

export type AuthorizeWorkflowResult = {
  intent: TransactionIntent;
  intent_commitment: string;
  challenge_id: string;
  platform_challenge: string;
  verification:
    | {
        authorized: true;
        merchant_identifier: string;
        intent_commitment: string;
        proof_challenge_id: string;
        verified_at: string;
        registry_version: number;
        settlement_rail: string;
        private_information_exposed: false;
      }
    | {
        authorized: false;
        reason: string;
        detail?: string;
        private_information_exposed: false;
      };
  settlement?: {
    ok: boolean;
    rail: string;
    settlement_id: string;
    routed_at: string;
    note: string;
  };
};

const BASE = "/skills/rail-agnostic-tx-auth";

export function buildTransactionIntent(input: {
  merchant_identifier: string;
  order_reference: string;
  amount: number;
  currency: string;
  settlement_rail: string;
  settlement_destination: string;
  nonce?: string;
  timestamp?: number;
}): Omit<TransactionIntent, "nonce" | "timestamp"> & {
  nonce?: string;
  timestamp?: number;
} {
  return {
    merchant_identifier: input.merchant_identifier.trim().toLowerCase(),
    order_reference: input.order_reference,
    amount: input.amount,
    currency: input.currency.toUpperCase(),
    settlement_rail: input.settlement_rail,
    settlement_destination: input.settlement_destination,
    nonce: input.nonce,
    timestamp: input.timestamp,
  };
}

export async function generateIntentCommitment(intent: Partial<TransactionIntent>) {
  return req<{ intent_commitment: string; canonical_payload: string }>(
    `${BASE}/intent/commit`,
    { method: "POST", body: JSON.stringify({ intent }) }
  );
}

export async function submitAuthorizationRequest(input: {
  merchant_identifier: string;
  order_reference: string;
  amount: number;
  currency: string;
  settlement_rail: string;
  settlement_destination: string;
  agent_session_id?: string;
  settle?: boolean;
}): Promise<AuthorizeWorkflowResult> {
  return req<AuthorizeWorkflowResult>(`${BASE}/authorize`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function verifyMerchantProof(input: {
  intent: TransactionIntent;
  intent_commitment: string;
  challenge_id: string;
  proof: unknown;
}) {
  return req<{ authorized: boolean; reason?: string }>(`${BASE}/verify`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function retrieveVerificationStatus() {
  return req<{
    brand_registry_root: string;
    registry_version: number;
    integrity: { root_matches_live: boolean; cache_validated: boolean };
  }>(`${BASE}/registry/sync`);
}

export async function getTxAuthSkillDocument() {
  return req<Record<string, unknown>>(BASE);
}
