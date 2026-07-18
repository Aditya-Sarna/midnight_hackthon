/**
 * Abstract settlement — rail adapters at the edge only.
 * Authorization is complete before this layer; circuit never imported here for rail logic.
 */
import type { SettlementReceipt, SettlementRequest } from "./types.js";
import { listRailIds, resolveRailAdapter } from "./rails/registry.js";

export function listSettlementRails(): string[] {
  return listRailIds();
}

export async function settleVerifiedTransaction(
  req: SettlementRequest
): Promise<SettlementReceipt> {
  if (!req.verification.authorized) {
    return {
      ok: false,
      rail: req.intent.settlement_rail,
      settlement_id: "",
      routed_at: new Date().toISOString(),
      note: "Settlement refused — transaction not authorized",
    };
  }
  const adapter = resolveRailAdapter(req.intent.settlement_rail);
  const dest = String(req.intent.settlement_destination);
  if (adapter.validateDestination && !adapter.validateDestination(dest as never)) {
    return {
      ok: false,
      rail: adapter.id,
      settlement_id: "",
      routed_at: new Date().toISOString(),
      note: "Settlement refused — destination rejected by rail adapter (edge validation only)",
    };
  }
  return adapter.settle(req);
}
