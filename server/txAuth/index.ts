/**
 * Rail-agnostic Transaction Authorization — public surface.
 */
export * from "./types.js";
export { asOpaqueDestination } from "./types.js";
export * from "./intent.js";
export {
  enrollMerchant,
  ensureDemoMerchants,
  findMerchant,
  publicMerchantView,
  registryDocument,
  snapshot,
  txAuthState,
} from "./registry.js";
export { revokeMerchant, revocationAccumulator, isNullifierRevoked } from "./revocation.js";
export { issueChallenge, consumeChallenge, peekChallenge, CHALLENGE_TTL_MS } from "./challenge.js";
export { authorizeIntent } from "./merchantAuth.js";
export { generateAuthorizedTxProof } from "./prover.js";
export { verifyAuthorizedTransaction } from "./verifier.js";
export { syncRegistry } from "./sync.js";
export { settleVerifiedTransaction, listSettlementRails } from "./settlement.js";
export {
  listRailAdapters,
  listRailIds,
  registerRailAdapter,
  resolveRailAdapter,
} from "./rails/index.js";
export { runAuthorizeWorkflow } from "./workflow.js";
export { metricsView } from "./metrics.js";

import type { Store } from "../services/store.js";
import { ensureDemoMerchants, registryDocument, txAuthState } from "./registry.js";
import { metricsView } from "./metrics.js";
import { TX_AUTH_CIRCUIT, TX_AUTH_SKILL, TX_AUTH_VERSION } from "./types.js";
import { listSettlementRails } from "./settlement.js";

export function skillDocument(store: Store) {
  ensureDemoMerchants(store);
  return {
    name: TX_AUTH_SKILL,
    version: TX_AUTH_VERSION,
    provider: "a26z-Brand",
    circuit: TX_AUTH_CIRCUIT,
    principle:
      "Authorize the transaction intent — not destination ownership. Destination is opaque to the circuit; rail differences live only in adapters.",
    registry: registryDocument(store),
    rails: listSettlementRails(),
    universal: {
      destination_opaque: true,
      adapters_only_for_new_rails: true,
      phases: [
        "intent_commitment",
        "prove_authorized_transaction",
        "rail_adapters",
        "jit_mint",
        "reconcile_order_ref",
        "settlement_confirmation",
        "credit_circuit",
        "cross_rail_eval",
      ],
    },
    endpoints: {
      skill: "GET /api/skills/rail-agnostic-tx-auth",
      authorize: "POST /api/skills/rail-agnostic-tx-auth/authorize",
      commit: "POST /api/skills/rail-agnostic-tx-auth/intent/commit",
      challenge: "POST /api/skills/rail-agnostic-tx-auth/challenge",
      merchantAuth: "POST /api/skills/rail-agnostic-tx-auth/merchant/authorize",
      prove: "POST /api/skills/rail-agnostic-tx-auth/prove",
      verify: "POST /api/skills/rail-agnostic-tx-auth/verify",
      sync: "GET /api/skills/rail-agnostic-tx-auth/registry/sync",
      revoke: "POST /api/skills/rail-agnostic-tx-auth/revoke",
      settle: "POST /api/skills/rail-agnostic-tx-auth/settle",
      rails: "GET /api/skills/rail-agnostic-tx-auth/rails",
      metrics: "GET /api/skills/rail-agnostic-tx-auth/metrics",
    },
    metrics: metricsView(txAuthState(store).metrics),
  };
}
