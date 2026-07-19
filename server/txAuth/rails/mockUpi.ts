import { randomNonce, sha256 } from "../../services/crypto.js";
import { asOpaqueDestination, type SettlementReceipt, type SettlementRequest } from "../types.js";
import type { ExtendedRailAdapter, RailQuote, RailReserve, RailStatusView } from "./types.js";

const entries = new Map<string, RailStatusView>();

export const mockUpiAdapter: ExtendedRailAdapter = {
  id: "mock_upi",
  label: "Mock UPI (demo only)",
  capabilities: () => ({
    sourceMethods: ["upi"],
    targetMethods: ["upi"],
    sourceAssets: ["INR"],
    targetAssets: ["INR"],
    canQuote: true,
    canReserve: true,
    canRefund: true,
    canWebhook: false,
    mock: true,
  }),
  mintDestination(input) {
    const digest = sha256(`mock:upi:${input.merchant_identifier}|${input.order_reference}|${input.nonce}`);
    return asOpaqueDestination(`mock_vpa_${digest.slice(0, 10)}@circleproof`);
  },
  validateDestination(destination) {
    return String(destination).includes("@");
  },
  async quote(req: SettlementRequest): Promise<RailQuote> {
    return {
      ok: true,
      quoteId: `q_upi_${randomNonce(8)}`,
      rail: "mock_upi",
      expiresAt: Date.now() + 120_000,
      sourceAsset: "INR",
      targetAsset: "INR",
      sourceAmount: String(req.intent.amount),
      targetAmount: String(req.intent.amount),
      feeAmount: "0.00",
      rate: "1",
      note: "Mock UPI quote — no real rupee movement.",
    };
  },
  async reserve(_req: SettlementRequest): Promise<RailReserve> {
    return { ok: true, reserveId: `rsv_upi_${randomNonce(8)}`, rail: "mock_upi", expiresAt: Date.now() + 180_000 };
  },
  async settle(_req: SettlementRequest): Promise<SettlementReceipt> {
    const settlementId = `stl_upi_${randomNonce(8)}`;
    entries.set(settlementId, { ok: true, rail: "mock_upi", refId: settlementId, status: "settled", updatedAt: Date.now() });
    return { ok: true, rail: "mock_upi", settlement_id: settlementId, routed_at: new Date().toISOString(), note: "Mock UPI settled — demo only" };
  },
  async refund(settlementId: string): Promise<SettlementReceipt> {
    const refundId = `ref_upi_${randomNonce(8)}`;
    entries.set(refundId, { ok: true, rail: "mock_upi", refId: refundId, status: "refunded", updatedAt: Date.now(), note: settlementId });
    return { ok: true, rail: "mock_upi", settlement_id: refundId, routed_at: new Date().toISOString(), note: `Mock UPI refund for ${settlementId}` };
  },
  async status(refId: string): Promise<RailStatusView> {
    return entries.get(refId) ?? { ok: false, rail: "mock_upi", refId, status: "unknown" };
  },
};