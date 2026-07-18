/**
 * Phase 10 — Receiving-payment skill surface.
 */
export * from "./types.js";
export { mintDestination, assertDestinationUnused } from "./mint.js";
export { observeInbound, reconcileByOrderRef, listUnmatched } from "./reconcile.js";
export { issueSettlementConfirmation, verifySettlementConfirmation } from "./confirm.js";
export { creditPrivateBalance } from "./credit.js";
export { creditInboundDigest, assertCreditBoundToIntent } from "./creditDigest.js";
export { resolveBuyerPaymentState } from "./buyerStatus.js";
export { runReceiveWorkflow } from "./workflow.js";
export { receivePayState } from "./state.js";

import type { Store } from "../services/store.js";
import { ensureDemoMerchants } from "../txAuth/registry.js";
import { receivePayState } from "./state.js";
import { CREDIT_CIRCUIT, RECEIVE_SKILL, RECEIVE_VERSION } from "./types.js";

export function skillDocument(store: Store) {
  ensureDemoMerchants(store);
  const s = receivePayState(store);
  return {
    name: RECEIVE_SKILL,
    version: RECEIVE_VERSION,
    provider: "a26z-Brand",
    circuit: CREDIT_CIRCUIT,
    principle:
      "Receive via just-in-time destinations; reconcile by order_ref; confirm intent_commitment; credit with prove_credit_update — never reuse a destination.",
    stats: {
      destinations_minted: s.destinations.length,
      spent_destinations: s.spent_destinations.length,
      confirmations: s.confirmations.length,
      unmatched_flagged: s.unmatched.length,
      credited: s.destinations.filter((d) => d.status === "credited").length,
    },
    endpoints: {
      skill: "GET /api/skills/receiving-payment",
      mint: "POST /api/skills/receiving-payment/mint-destination",
      observe: "POST /api/skills/receiving-payment/observe",
      reconcile: "POST /api/skills/receiving-payment/reconcile",
      unmatched: "GET /api/skills/receiving-payment/unmatched",
      confirm: "POST /api/skills/receiving-payment/confirm",
      buyerStatus: "POST /api/skills/receiving-payment/buyer-status",
      credit: "POST /api/skills/receiving-payment/credit",
      receive: "POST /api/skills/receiving-payment/receive",
      webhook: "POST /api/skills/receiving-payment/webhook",
    },
    exit_criterion:
      "Merchant receives payment, reconciles by order_ref, flags unmatched inbounds, issues settlement confirmation, and updates private balance via prove_credit_update without destination reuse.",
  };
}
