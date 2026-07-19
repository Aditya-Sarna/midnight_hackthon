import { randomNonce, sha256 } from "../../services/crypto.js";
import { asOpaqueDestination, type SettlementReceipt, type SettlementRequest } from "../types.js";
import type { ExtendedRailAdapter, RailReserve, RailStatusView } from "./types.js";

const entries = new Map<string, RailStatusView>();

export const mockCardAdapter: ExtendedRailAdapter = {
  id: "mock_card",
  label: "Mock card processor (demo only)",
  capabilities: () => ({
    sourceMethods: ["card"],
    targetMethods: [],
    sourceAssets: ["INR", "USD"],
    targetAssets: [],
    canQuote: false,
    canReserve: true,
    canRefund: true,
    canWebhook: false,
    mock: true,
  }),
  mintDestination(input) {
    const digest = sha256(`mock:card:${input.merchant_identifier}|${input.order_reference}|${input.nonce}`);
    return asOpaqueDestination(`mock_card_tok_${digest.slice(0, 24)}`);
  },
  validateDestination(destination) {
    return String(destination).startsWith("mock_card_tok_");
  },
  async reserve(_req: SettlementRequest): Promise<RailReserve> {
    return { ok: true, reserveId: `auth_card_${randomNonce(8)}`, rail: "mock_card", expiresAt: Date.now() + 180_000, note: "Mock authorization hold" };
  },
  async settle(_req: SettlementRequest): Promise<SettlementReceipt> {
    const settlementId = `cap_card_${randomNonce(8)}`;
    entries.set(settlementId, { ok: true, rail: "mock_card", refId: settlementId, status: "settled", updatedAt: Date.now() });
    return { ok: true, rail: "mock_card", settlement_id: settlementId, routed_at: new Date().toISOString(), note: "Mock card captured — demo only" };
  },
  async refund(settlementId: string): Promise<SettlementReceipt> {
    const refundId = `ref_card_${randomNonce(8)}`;
    entries.set(refundId, { ok: true, rail: "mock_card", refId: refundId, status: "refunded", updatedAt: Date.now(), note: settlementId });
    return { ok: true, rail: "mock_card", settlement_id: refundId, routed_at: new Date().toISOString(), note: `Mock card refund for ${settlementId}` };
  },
  async status(refId: string): Promise<RailStatusView> {
    return entries.get(refId) ?? { ok: false, rail: "mock_card", refId, status: "unknown" };
  },
};