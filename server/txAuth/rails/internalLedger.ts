/**
 * Sandbox / internal-ledger rail — pilot money movement for CIRCLE units.
 * Implements quote → reserve → settle → refund → status behind RailAdapter.
 * Not a licensed bank/UPI/card rail.
 */
import { randomNonce, sha256 } from "../../services/crypto.js";
import { asOpaqueDestination } from "../types.js";
import type { SettlementReceipt, SettlementRequest } from "../types.js";
import type { ExtendedRailAdapter, RailQuote, RailReserve, RailStatusView } from "./types.js";

type LedgerEntry = {
  id: string;
  intentPrefix: string;
  status: "quoted" | "reserved" | "settled" | "refunded" | "failed";
  reservedAt?: number;
  settledAt?: number;
  refundedAt?: number;
  note: string;
};

const ledger = new Map<string, LedgerEntry>();

export const internalLedgerAdapter: ExtendedRailAdapter = {
  id: "internal_ledger",
  label: "CIRCLE internal ledger (sandbox)",
  mintDestination(input) {
    const digest = sha256(
      `rail:internal:${input.merchant_identifier}|${input.order_reference}|${input.nonce}`
    );
    return asOpaqueDestination(`ilt_${digest.slice(0, 40)}`);
  },
  validateDestination(destination) {
    return String(destination).startsWith("ilt_");
  },
  async quote(req: SettlementRequest): Promise<RailQuote> {
    const id = `q_${randomNonce(8)}`;
    ledger.set(id, {
      id,
      intentPrefix: req.intent_commitment.slice(0, 16),
      status: "quoted",
      note: "internal ledger quote — no PSP",
    });
    return {
      ok: true,
      quoteId: id,
      rail: "internal_ledger",
      expiresAt: Date.now() + 120_000,
      note: "Sandbox quote; asset=CIRCLE_UNIT",
    };
  },
  async reserve(req: SettlementRequest): Promise<RailReserve> {
    const id = `rsv_${randomNonce(8)}`;
    ledger.set(id, {
      id,
      intentPrefix: req.intent_commitment.slice(0, 16),
      status: "reserved",
      reservedAt: Date.now(),
      note: "funds reserved on internal ledger",
    });
    return {
      ok: true,
      reserveId: id,
      rail: "internal_ledger",
      expiresAt: Date.now() + 300_000,
    };
  },
  async settle(req: SettlementRequest): Promise<SettlementReceipt> {
    const reserve = [...ledger.values()].find(
      (e) =>
        e.intentPrefix === req.intent_commitment.slice(0, 16) && e.status === "reserved"
    );
    const settlement_id = `stl_ilt_${randomNonce(8)}`;
    ledger.set(settlement_id, {
      id: settlement_id,
      intentPrefix: req.intent_commitment.slice(0, 16),
      status: "settled",
      reservedAt: reserve?.reservedAt,
      settledAt: Date.now(),
      note: `Internal ledger settled${reserve ? ` from ${reserve.id}` : " (direct)"}`,
    });
    return {
      ok: true,
      rail: "internal_ledger",
      settlement_id,
      routed_at: new Date().toISOString(),
      note: "CIRCLE unit internal-ledger settle — pilot, not bank ACH",
    };
  },
  async refund(settlementId: string): Promise<SettlementReceipt> {
    const entry = ledger.get(settlementId);
    if (!entry || entry.status !== "settled") {
      return {
        ok: false,
        rail: "internal_ledger",
        settlement_id: settlementId,
        routed_at: new Date().toISOString(),
        note: "Refund rejected — settlement not found or not settled",
      };
    }
    entry.status = "refunded";
    entry.refundedAt = Date.now();
    const refundId = `ref_${randomNonce(8)}`;
    ledger.set(refundId, { ...entry, id: refundId, status: "refunded" });
    return {
      ok: true,
      rail: "internal_ledger",
      settlement_id: refundId,
      routed_at: new Date().toISOString(),
      note: `Refunded ${settlementId}`,
    };
  },
  async status(refId: string): Promise<RailStatusView> {
    const entry = ledger.get(refId);
    if (!entry) {
      return { ok: false, rail: "internal_ledger", refId, status: "unknown" };
    }
    return {
      ok: true,
      rail: "internal_ledger",
      refId,
      status: entry.status,
      updatedAt: entry.settledAt ?? entry.reservedAt ?? Date.now(),
    };
  },
};

/** Test helper */
export function resetInternalLedger() {
  ledger.clear();
}
