/**
 * Multi-leg universal settle helpers — synthetic SettlementRequest for rail adapters.
 */
import { randomNonce } from "./crypto.js";
import { asOpaqueDestination } from "../txAuth/types.js";
import type { SettlementRequest, TransactionIntent } from "../txAuth/types.js";
import { resolveRailAdapter } from "../txAuth/rails/registry.js";
import type { ExtendedRailAdapter } from "../txAuth/rails/types.js";
import { getSandboxAccount } from "./sandboxAccounts.js";

export function buildUniversalSettleRequest(input: {
  intentCommitment: string;
  amount: number;
  currency: string;
  rail: string;
  accountId: string;
}): SettlementRequest {
  const account = getSandboxAccount(input.accountId);
  const dest =
    account?.stripeAccountId ||
    account?.opaqueDestinationId ||
    `stripe_${input.accountId}`;
  const intent: TransactionIntent = {
    merchant_identifier: "circle_universal_pilot",
    order_reference: `uni_${input.intentCommitment.slice(0, 16)}`,
    amount: input.amount,
    currency: input.currency,
    settlement_rail: input.rail,
    settlement_destination: asOpaqueDestination(dest),
    nonce: randomNonce(8),
    timestamp: Date.now(),
  };
  const chal = `chal_uni_${input.intentCommitment.slice(0, 16)}`;
  return {
    intent,
    intent_commitment: input.intentCommitment,
    proof_challenge_id: chal,
    verification: {
      authorized: true,
      merchant_identifier: intent.merchant_identifier,
      intent_commitment: input.intentCommitment,
      proof_challenge_id: chal,
      verified_at: new Date().toISOString(),
      registry_version: 1,
      settlement_rail: input.rail,
      private_information_exposed: false,
      checks: {
        membership: true,
        authorization_signature: true,
        not_revoked: true,
        challenge_fresh: true,
        intent_bound: true,
      },
    },
  };
}

export function asExtended(railId: string): ExtendedRailAdapter {
  const adapter = resolveRailAdapter(railId) as ExtendedRailAdapter;
  return adapter;
}

/** Map planner adapter name → registered rail id */
export function resolveUniversalRailId(adapterName: string): string {
  if (adapterName === "stripe_test" || adapterName === "bank_sandbox") return "stripe_test";
  if (adapterName === "bitcoin_sandbox") return "stripe_test";
  if (adapterName === "mock_fx") return "mock_fx";
  if (adapterName === "mock_upi" || adapterName === "upi") return "sandbox_psp";
  if (adapterName === "internal_ledger") return "internal_ledger";
  return adapterName;
}
