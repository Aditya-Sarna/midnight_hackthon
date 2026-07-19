/**
 * Sandbox PSP — full quote/reserve/settle/refund/status + HMAC webhook.
 * Honest label: NOT a licensed UPI/bank/card rail. Pilot money-movement contract only.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { randomNonce, sha256 } from "../../services/crypto.js";
import { asOpaqueDestination } from "../types.js";
import type { SettlementReceipt, SettlementRequest } from "../types.js";
import type {
  ExtendedRailAdapter,
  RailCapabilities,
  RailQuote,
  RailReserve,
  RailStatusView,
} from "./types.js";

type PspEntry = {
  id: string;
  intentPrefix: string;
  status: "quoted" | "reserved" | "settled" | "refunded" | "failed" | "webhook_acked";
  reservedAt?: number;
  settledAt?: number;
  refundedAt?: number;
  webhookAt?: number;
  note: string;
};

const ledger = new Map<string, PspEntry>();

function webhookSecret(): string {
  return process.env.SANDBOX_PSP_WEBHOOK_SECRET?.trim() || "circled-sandbox-psp-dev-secret";
}

export function signSandboxPspWebhook(body: string): string {
  return createHmac("sha256", webhookSecret()).update(body).digest("hex");
}

export function verifySandboxPspWebhook(body: string, signature: string): boolean {
  const expected = signSandboxPspWebhook(body);
  try {
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(String(signature).replace(/^sha256=/, ""), "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export const sandboxPspAdapter: ExtendedRailAdapter = {
  id: "sandbox_psp",
  label: "Sandbox PSP (not licensed — pilot contract)",
  capabilities(): RailCapabilities {
    return {
      sourceMethods: ["wallet_topup", "internal"],
      targetMethods: ["wallet_payout", "merchant"],
      sourceAssets: ["CIRCLE"],
      targetAssets: ["CIRCLE"],
      canQuote: true,
      canReserve: true,
      canRefund: true,
      canWebhook: true,
      mock: true,
    };
  },
  mintDestination(input) {
    const digest = sha256(
      `rail:sandbox_psp:${input.merchant_identifier}|${input.order_reference}|${input.nonce}`
    );
    return asOpaqueDestination(`psp_${digest.slice(0, 40)}`);
  },
  validateDestination(destination) {
    return String(destination).startsWith("psp_");
  },
  async quote(req: SettlementRequest): Promise<RailQuote> {
    const id = `q_psp_${randomNonce(8)}`;
    ledger.set(id, {
      id,
      intentPrefix: req.intent_commitment.slice(0, 16),
      status: "quoted",
      note: "sandbox PSP quote",
    });
    return {
      ok: true,
      quoteId: id,
      rail: "sandbox_psp",
      expiresAt: Date.now() + 120_000,
      sourceAsset: "CIRCLE",
      targetAsset: "CIRCLE",
      note: "Sandbox PSP — not a licensed bank/UPI/card rail",
    };
  },
  async reserve(req: SettlementRequest): Promise<RailReserve> {
    const id = `rsv_psp_${randomNonce(8)}`;
    ledger.set(id, {
      id,
      intentPrefix: req.intent_commitment.slice(0, 16),
      status: "reserved",
      reservedAt: Date.now(),
      note: "sandbox PSP reserve",
    });
    return {
      ok: true,
      reserveId: id,
      rail: "sandbox_psp",
      expiresAt: Date.now() + 300_000,
    };
  },
  async settle(req: SettlementRequest): Promise<SettlementReceipt> {
    const settlement_id = `stl_psp_${randomNonce(8)}`;
    ledger.set(settlement_id, {
      id: settlement_id,
      intentPrefix: req.intent_commitment.slice(0, 16),
      status: "settled",
      settledAt: Date.now(),
      note: "sandbox PSP settled — await webhook for ops ack",
    });
    return {
      ok: true,
      rail: "sandbox_psp",
      settlement_id,
      routed_at: new Date().toISOString(),
      note: "Sandbox PSP settle OK — POST /api/rails/sandbox_psp/webhook with HMAC to ack",
    };
  },
  async refund(settlementId: string): Promise<SettlementReceipt> {
    const entry = ledger.get(settlementId);
    if (!entry || (entry.status !== "settled" && entry.status !== "webhook_acked")) {
      return {
        ok: false,
        rail: "sandbox_psp",
        settlement_id: settlementId,
        routed_at: new Date().toISOString(),
        note: "Refund rejected — settlement not found",
      };
    }
    entry.status = "refunded";
    entry.refundedAt = Date.now();
    const refundId = `ref_psp_${randomNonce(8)}`;
    ledger.set(refundId, { ...entry, id: refundId, status: "refunded" });
    return {
      ok: true,
      rail: "sandbox_psp",
      settlement_id: refundId,
      routed_at: new Date().toISOString(),
      note: `Refunded ${settlementId}`,
    };
  },
  async status(refId: string): Promise<RailStatusView> {
    const entry = ledger.get(refId);
    if (!entry) {
      return { ok: false, rail: "sandbox_psp", refId, status: "unknown" };
    }
    return {
      ok: true,
      rail: "sandbox_psp",
      refId,
      status: entry.status,
      updatedAt: entry.webhookAt ?? entry.settledAt ?? entry.reservedAt ?? Date.now(),
      note: entry.note,
    };
  },
  async handleWebhook(payload: unknown): Promise<RailStatusView> {
    const p = (payload ?? {}) as {
      settlement_id?: string;
      event?: string;
      signature?: string;
      rawBody?: string;
    };
    const settlementId = String(p.settlement_id ?? "");
    const entry = ledger.get(settlementId);
    if (!entry) {
      return {
        ok: false,
        rail: "sandbox_psp",
        refId: settlementId,
        status: "unknown",
        note: "Unknown settlement_id",
      };
    }
    if (p.rawBody != null && p.signature != null) {
      if (!verifySandboxPspWebhook(p.rawBody, p.signature)) {
        return {
          ok: false,
          rail: "sandbox_psp",
          refId: settlementId,
          status: entry.status,
          note: "Invalid HMAC signature",
        };
      }
    }
    entry.status = "webhook_acked";
    entry.webhookAt = Date.now();
    entry.note = `webhook ${p.event ?? "settlement.updated"}`;
    return {
      ok: true,
      rail: "sandbox_psp",
      refId: settlementId,
      status: entry.status,
      updatedAt: entry.webhookAt,
      note: entry.note,
    };
  },
};

export function resetSandboxPsp() {
  ledger.clear();
}
