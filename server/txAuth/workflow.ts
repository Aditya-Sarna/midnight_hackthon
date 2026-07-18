/**
 * Phase 11 — End-to-end agent authorization workflow.
 */
import type { Store } from "../services/store.js";
import { issueChallenge } from "./challenge.js";
import { commitIntent } from "./intent.js";
import { authorizeIntent } from "./merchantAuth.js";
import { generateAuthorizedTxProof } from "./prover.js";
import { ensureDemoMerchants } from "./registry.js";
import { settleVerifiedTransaction } from "./settlement.js";
import { syncRegistry } from "./sync.js";
import { verifyAuthorizedTransaction } from "./verifier.js";
import type { SettlementReceipt, TransactionIntent, VerificationResult } from "./types.js";
import { randomNonce } from "../services/crypto.js";

export type AuthorizeWorkflowInput = {
  merchant_identifier: string;
  order_reference: string;
  amount: number;
  currency: string;
  settlement_rail: string;
  settlement_destination: string;
  agent_session_id?: string;
  /** When true, forward to abstract settlement after verify */
  settle?: boolean;
};

export type AuthorizeWorkflowResult = {
  intent: TransactionIntent;
  intent_commitment: string;
  challenge_id: string;
  platform_challenge: string;
  verification: VerificationResult;
  settlement?: SettlementReceipt;
  registry: ReturnType<typeof syncRegistry>;
};

export async function runAuthorizeWorkflow(
  store: Store,
  input: AuthorizeWorkflowInput
): Promise<AuthorizeWorkflowResult> {
  ensureDemoMerchants(store);

  // 1–2. Construct intent + commitment
  const intent: TransactionIntent = {
    merchant_identifier: input.merchant_identifier.trim().toLowerCase(),
    order_reference: input.order_reference,
    amount: input.amount,
    currency: input.currency.toUpperCase(),
    settlement_rail: input.settlement_rail,
    settlement_destination: input.settlement_destination,
    nonce: randomNonce(16),
    timestamp: Date.now(),
  };
  const { intent_commitment } = commitIntent(intent);

  // 3. Platform challenge
  const challenge = issueChallenge(store, {
    intent_commitment,
    agent_session_id: input.agent_session_id,
  });

  // 4–5. Merchant authorization + proof
  const auth = await authorizeIntent(store, { intent, intent_commitment });
  if (!auth.ok) {
    const reason =
      auth.reason === "nullifier_revoked" ||
      auth.reason === "intent_commitment_mismatch" ||
      auth.reason === "policy_rejected" ||
      auth.reason === "merchant_not_found"
        ? auth.reason
        : "merchant_not_found";
    return {
      intent,
      intent_commitment,
      challenge_id: challenge.challenge_id,
      platform_challenge: challenge.platform_challenge,
      verification: {
        authorized: false,
        reason,
        detail: auth.detail,
        private_information_exposed: false,
      },
      registry: syncRegistry(store),
    };
  }

  const proved = await generateAuthorizedTxProof(store, {
    merchant_identifier: intent.merchant_identifier,
    intent_commitment,
    challenge_id: challenge.challenge_id,
    authorization: auth.authorization,
  });
  if (!proved.ok) {
    return {
      intent,
      intent_commitment,
      challenge_id: challenge.challenge_id,
      platform_challenge: challenge.platform_challenge,
      verification: {
        authorized: false,
        reason: (proved.reason as never) || "proof_invalid",
        detail: proved.detail,
        private_information_exposed: false,
      },
      registry: syncRegistry(store),
    };
  }

  // 6–10. Sync registry + verify
  const registry = syncRegistry(store);
  const verification = verifyAuthorizedTransaction(store, {
    intent,
    intent_commitment,
    challenge_id: challenge.challenge_id,
    proof: proved.proof,
  });

  // 11–12. Optional settlement
  let settlement: SettlementReceipt | undefined;
  if (input.settle && verification.authorized) {
    settlement = await settleVerifiedTransaction({
      intent,
      intent_commitment,
      verification,
      proof_challenge_id: challenge.challenge_id,
    });
  }

  return {
    intent,
    intent_commitment,
    challenge_id: challenge.challenge_id,
    platform_challenge: challenge.platform_challenge,
    verification,
    settlement,
    registry,
  };
}
