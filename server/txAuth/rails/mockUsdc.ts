import { randomNonce, sha256 } from "../../services/crypto.js";
import { asOpaqueDestination, type SettlementReceipt, type SettlementRequest } from "../types.js";
import type { ExtendedRailAdapter, RailStatusView } from "./types.js";

const entries = new Map<string, RailStatusView>();

export const mockUsdcAdapter: ExtendedRailAdapter = {
  id: "mock_usdc",
  label: "Mock USDC wallet (demo only)",
  capabilities: () => ({
    sourceMethods: ["stablecoin_wallet"],
    targetMethods: ["stablecoin_wallet"],
    sourceAssets: ["USDC"],
    targetAssets: ["USDC"],
    canQuote: true,
    canReserve: false,
    canRefund: true,
    canWebhook: false,
    mock: true,
  }),
  mintDestination(input) {
    const digest = sha256(`mock:usdc:${input.merchant_identifier}|${input.order_reference}|${input.nonce}`);
    return asOpaqueDestination(`mock_usdc_${digest.slice(0, 40)}`);
  },
  validateDestination(destination) {
    return String(destination).startsWith("mock_usdc_");
  },
  async settle(_req: SettlementRequest): Promise<SettlementReceipt> {
    const settlementId = `stl_usdc_${randomNonce(8)}`;
    entries.set(settlementId, { ok: true, rail: "mock_usdc", refId: settlementId, status: "settled", updatedAt: Date.now() });
    return { ok: true, rail: "mock_usdc", settlement_id: settlementId, routed_at: new Date().toISOString(), note: "Mock USDC transfer — demo only" };
  },
  async refund(settlementId: string): Promise<SettlementReceipt> {
    const refundId = `ref_usdc_${randomNonce(8)}`;
    entries.set(refundId, { ok: true, rail: "mock_usdc", refId: refundId, status: "refunded", updatedAt: Date.now(), note: settlementId });
    return { ok: true, rail: "mock_usdc", settlement_id: refundId, routed_at: new Date().toISOString(), note: `Mock USDC refund for ${settlementId}` };
  },
  async status(refId: string): Promise<RailStatusView> {
    return entries.get(refId) ?? { ok: false, rail: "mock_usdc", refId, status: "unknown" };
  },
};