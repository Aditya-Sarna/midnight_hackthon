/**
 * FX conversion leg for universal multi-rail routes — pilot only.
 */
import { randomNonce, sha256 } from "../../services/crypto.js";
import { asOpaqueDestination } from "../types.js";
import type { SettlementReceipt, SettlementRequest } from "../types.js";
import type { ExtendedRailAdapter, RailCapabilities, RailStatusView } from "./types.js";

const ledger = new Map<string, { status: string; intentKey: string; at: number }>();

export const mockFxAdapter: ExtendedRailAdapter = {
  id: "mock_fx",
  label: "Sandbox FX conversion (pilot)",
  capabilities(): RailCapabilities {
    return {
      sourceMethods: ["fx"],
      targetMethods: ["fx"],
      sourceAssets: ["INR", "USD", "BTC", "CIRCLE_UNIT"],
      targetAssets: ["INR", "USD", "BTC", "CIRCLE_UNIT"],
      canQuote: true,
      canReserve: true,
      canRefund: true,
      canWebhook: false,
      mock: true,
    };
  },
  mintDestination(input) {
    return asOpaqueDestination(
      `fx_${sha256(`fx:${input.merchant_identifier}|${input.nonce}`).slice(0, 32)}`
    );
  },
  async settle(req: SettlementRequest): Promise<SettlementReceipt> {
    const settlement_id = `stl_fx_${randomNonce(8)}`;
    ledger.set(settlement_id, {
      status: "settled",
      intentKey: req.intent_commitment.slice(0, 32),
      at: Date.now(),
    });
    return {
      ok: true,
      rail: "mock_fx",
      settlement_id,
      routed_at: new Date().toISOString(),
      note: "Sandbox FX conversion completed",
    };
  },
  async refund(settlementId: string): Promise<SettlementReceipt> {
    const e = ledger.get(settlementId);
    if (!e) {
      return {
        ok: false,
        rail: "mock_fx",
        settlement_id: settlementId,
        routed_at: new Date().toISOString(),
        note: "FX settlement not found",
      };
    }
    e.status = "refunded";
    return {
      ok: true,
      rail: "mock_fx",
      settlement_id: `ref_fx_${randomNonce(6)}`,
      routed_at: new Date().toISOString(),
      note: `FX reverse ${settlementId}`,
    };
  },
  async status(refId: string): Promise<RailStatusView> {
    const e = ledger.get(refId);
    return {
      ok: Boolean(e),
      rail: "mock_fx",
      refId,
      status: e?.status || "not_found",
      updatedAt: e?.at,
    };
  },
};

export function resetMockFx() {
  ledger.clear();
}
