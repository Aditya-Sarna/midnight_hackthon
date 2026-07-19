import { randomNonce } from "../../services/crypto.js";
import { asOpaqueDestination, type SettlementReceipt, type SettlementRequest } from "../types.js";
import type { ExtendedRailAdapter, RailQuote, RailStatusView } from "./types.js";

const entries = new Map<string, RailStatusView>();

export const mockFxAdapter: ExtendedRailAdapter = {
  id: "mock_fx",
  label: "Mock FX conversion (demo only)",
  capabilities: () => ({
    sourceMethods: ["conversion"],
    targetMethods: ["conversion"],
    sourceAssets: ["INR", "USD", "USDC", "CIRCLE_UNIT"],
    targetAssets: ["INR", "USD", "USDC", "CIRCLE_UNIT"],
    canQuote: true,
    canReserve: false,
    canRefund: true,
    canWebhook: false,
    mock: true,
  }),
  mintDestination(input) {
    return asOpaqueDestination(`mock_fx_${input.order_reference}_${input.nonce}`);
  },
  async quote(req: SettlementRequest): Promise<RailQuote> {
    return { ok: true, quoteId: `q_fx_${randomNonce(8)}`, rail: "mock_fx", expiresAt: Date.now() + 120_000, sourceAmount: String(req.intent.amount), note: "Mock deterministic conversion quote" };
  },
  async settle(_req: SettlementRequest): Promise<SettlementReceipt> {
    const settlementId = `stl_fx_${randomNonce(8)}`;
    entries.set(settlementId, { ok: true, rail: "mock_fx", refId: settlementId, status: "settled", updatedAt: Date.now() });
    return { ok: true, rail: "mock_fx", settlement_id: settlementId, routed_at: new Date().toISOString(), note: "Mock FX conversion — demo only" };
  },
  async refund(settlementId: string): Promise<SettlementReceipt> {
    const refundId = `ref_fx_${randomNonce(8)}`;
    entries.set(refundId, { ok: true, rail: "mock_fx", refId: refundId, status: "refunded", updatedAt: Date.now(), note: settlementId });
    return { ok: true, rail: "mock_fx", settlement_id: refundId, routed_at: new Date().toISOString(), note: `Mock FX reversal for ${settlementId}` };
  },
  async status(refId: string): Promise<RailStatusView> {
    return entries.get(refId) ?? { ok: false, rail: "mock_fx", refId, status: "unknown" };
  },
};