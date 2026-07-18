/**
 * Phase 10 end-to-end: mint → observe inbound → reconcile → confirm → credit.
 */
import { commit, randomNonce } from "../services/crypto.js";
import type { Store } from "../services/store.js";
import { issueSettlementConfirmation } from "./confirm.js";
import { creditPrivateBalance } from "./credit.js";
import { mintDestination } from "./mint.js";
import { observeInbound, reconcileByOrderRef } from "./reconcile.js";
import type {
  CreditAttestation,
  InboundObservation,
  MintedDestination,
  SettlementConfirmation,
} from "./types.js";

export type ReceiveWorkflowInput = {
  merchant_identifier: string;
  order_reference: string;
  amount: number;
  currency: string;
  settlement_rail: string;
  /** When true, simulate inbound detection after mint */
  simulate_inbound?: boolean;
  /** Optional public account for credit commitment update */
  merchant_account_id?: string;
  /** Prior merchant balance commitment (credit path) */
  old_balance_commitment?: string;
  /** When omitted, derives a demo new commitment */
  new_balance_commitment?: string;
  run_credit?: boolean;
};

export type ReceiveWorkflowResult = {
  ok: boolean;
  intent_commitment?: string;
  destination?: MintedDestination;
  observation?: InboundObservation;
  confirmation?: SettlementConfirmation;
  attestation?: CreditAttestation;
  reason?: string;
  detail?: string;
  exit_criterion: {
    received: boolean;
    reconciled_by_order_ref: boolean;
    settlement_confirmed: boolean;
    private_balance_credited: boolean;
    destination_never_reused: boolean;
  };
};

export async function runReceiveWorkflow(
  store: Store,
  input: ReceiveWorkflowInput
): Promise<ReceiveWorkflowResult> {
  const fail = (reason: string, detail?: string): ReceiveWorkflowResult => ({
    ok: false,
    reason,
    detail,
    exit_criterion: {
      received: false,
      reconciled_by_order_ref: false,
      settlement_confirmed: false,
      private_balance_credited: false,
      destination_never_reused: false,
    },
  });

  const minted = mintDestination(store, {
    intent: {
      merchant_identifier: input.merchant_identifier,
      order_reference: input.order_reference,
      amount: input.amount,
      currency: input.currency,
      settlement_rail: input.settlement_rail,
      nonce: randomNonce(16),
      timestamp: Date.now(),
    },
  });
  if (!minted.ok) return fail(minted.reason, minted.detail);

  let observation: InboundObservation | undefined;
  if (input.simulate_inbound !== false) {
    const obs = observeInbound(store, {
      order_reference: input.order_reference,
      payment_ref: `pay_${randomNonce(8)}`,
      amount: input.amount,
      currency: input.currency,
      settlement_destination: minted.destination.settlement_destination,
    });
    if (!obs.ok) return fail(obs.reason, obs.detail);
    observation = obs.observation;
  }

  const reconciled = reconcileByOrderRef(store, input.order_reference);
  if (!reconciled.ok) return fail(reconciled.reason, reconciled.detail);

  const confirmed = await issueSettlementConfirmation(store, {
    order_reference: input.order_reference,
  });
  if (!confirmed.ok) return fail(confirmed.reason, confirmed.detail);

  let attestation: CreditAttestation | undefined;
  if (input.run_credit !== false) {
    const old =
      input.old_balance_commitment ||
      (input.merchant_account_id
        ? store.users.find((u) => u.id === input.merchant_account_id)?.balanceCommitment
        : undefined) ||
      commit(0, randomNonce(8));
    // Demo: deterministic "new" commitment when not supplied (device would compute privately)
    const neu =
      input.new_balance_commitment ||
      commit(input.amount, `credit:${minted.intent_commitment}:${randomNonce(8)}`);

    const credited = await creditPrivateBalance(store, {
      order_reference: input.order_reference,
      merchant_account_id: input.merchant_account_id,
      old_balance_commitment: old,
      new_balance_commitment: neu,
    });
    if (!credited.ok) return fail(credited.reason, credited.detail);
    attestation = credited.attestation;
  }

  return {
    ok: true,
    intent_commitment: minted.intent_commitment,
    destination: minted.destination,
    observation,
    confirmation: confirmed.confirmation,
    attestation,
    exit_criterion: {
      received: Boolean(observation),
      reconciled_by_order_ref: true,
      settlement_confirmed: true,
      private_balance_credited: Boolean(attestation?.compact_ok),
      destination_never_reused: minted.destination.destination_spent === true,
    },
  };
}
