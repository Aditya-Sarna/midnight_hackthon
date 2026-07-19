/**
 * Stripe TEST-mode rail — capped pilot money movement.
 *
 * When STRIPE_SECRET_KEY=sk_test_… is set: real Stripe PaymentIntent (TEST) via HTTPS.
 * Otherwise: local Stripe-test-shaped ledger with idempotency + webhook ack
 * (allowed only when not strict, or NYXPAY_UNIVERSAL_LOCAL_STRIPE=1).
 *
 * Never uses sk_live_. Not a licensed bank/UPI rail.
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

type StripeEntry = {
  id: string;
  intentKey: string;
  status: "quoted" | "reserved" | "settled" | "refunded" | "failed" | "webhook_acked";
  stripePaymentIntentId?: string;
  amount?: string;
  currency?: string;
  reservedAt?: number;
  settledAt?: number;
  refundedAt?: number;
  webhookAt?: number;
  note: string;
};

const ledger = new Map<string, StripeEntry>();
const idempotency = new Map<string, string>(); // intentKey → settlement_id
const webhookEvents = new Set<string>();

export function stripeSecretKey(): string | null {
  const k = process.env.STRIPE_SECRET_KEY?.trim() || "";
  if (!k) return null;
  if (k.startsWith("sk_live_")) {
    throw new Error("STRIPE_SECRET_KEY must be sk_test_… — live keys forbidden in this pilot");
  }
  if (!k.startsWith("sk_test_")) {
    throw new Error("STRIPE_SECRET_KEY must start with sk_test_");
  }
  return k;
}

export function stripeTestMode(): "stripe_api" | "local_ledger" | "disabled" {
  try {
    if (stripeSecretKey()) return "stripe_api";
  } catch {
    return "disabled";
  }
  if (
    process.env.NYXPAY_UNIVERSAL_LOCAL_STRIPE === "1" ||
    process.env.VITEST ||
    process.env.NYXPAY_BOOT_SOFT === "1" ||
    process.env.NODE_ENV !== "production"
  ) {
    return "local_ledger";
  }
  return "disabled";
}

function webhookSecret(): string {
  return (
    process.env.STRIPE_WEBHOOK_SECRET?.trim() ||
    process.env.SANDBOX_PSP_WEBHOOK_SECRET?.trim() ||
    "whsec_circled_stripe_test_dev"
  );
}

export function signStripeTestWebhook(body: string): string {
  return createHmac("sha256", webhookSecret()).update(body).digest("hex");
}

export function verifyStripeTestWebhook(body: string, signature: string): boolean {
  const expected = signStripeTestWebhook(body);
  try {
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(String(signature).replace(/^sha256=/, "").replace(/^t=\d+,v1=/, ""), "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function intentKey(req: SettlementRequest): string {
  return req.intent_commitment.slice(0, 32);
}

async function stripeFetch(
  path: string,
  params: Record<string, string>
): Promise<{ ok: boolean; id?: string; status?: string; error?: string }> {
  const key = stripeSecretKey();
  if (!key) return { ok: false, error: "no stripe key" };
  const body = new URLSearchParams(params);
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const json = (await res.json()) as {
    id?: string;
    status?: string;
    error?: { message?: string };
  };
  if (!res.ok) {
    return { ok: false, error: json.error?.message || res.statusText };
  }
  return { ok: true, id: json.id, status: json.status };
}

export const stripeTestAdapter: ExtendedRailAdapter = {
  id: "stripe_test",
  label: "Stripe TEST mode (Connect/PaymentIntent — not live)",
  capabilities(): RailCapabilities {
    const mode = stripeTestMode();
    return {
      sourceMethods: ["card_test", "wallet"],
      targetMethods: ["connect_payout", "payment_intent"],
      sourceAssets: ["USD", "INR", "BTC", "CIRCLE_UNIT"],
      targetAssets: ["USD", "BTC", "CIRCLE_UNIT"],
      canQuote: true,
      canReserve: true,
      canRefund: true,
      canWebhook: true,
      mock: mode !== "stripe_api",
    };
  },
  mintDestination(input) {
    const digest = sha256(
      `rail:stripe_test:${input.merchant_identifier}|${input.order_reference}|${input.nonce}`
    );
    return asOpaqueDestination(`stripe_${digest.slice(0, 40)}`);
  },
  validateDestination(destination) {
    const d = String(destination);
    return d.startsWith("stripe_") || d.startsWith("acct_");
  },
  async quote(req: SettlementRequest): Promise<RailQuote> {
    if (stripeTestMode() === "disabled") {
      return {
        ok: false,
        quoteId: "",
        rail: "stripe_test",
        expiresAt: 0,
        note: "Stripe TEST disabled — set STRIPE_SECRET_KEY=sk_test_… or NYXPAY_UNIVERSAL_LOCAL_STRIPE=1",
      };
    }
    const id = `q_stripe_${randomNonce(8)}`;
    ledger.set(id, {
      id,
      intentKey: intentKey(req),
      status: "quoted",
      note: "stripe test quote",
      currency: req.intent.currency,
      amount: String(req.intent.amount),
    });
    return {
      ok: true,
      quoteId: id,
      rail: "stripe_test",
      expiresAt: Date.now() + 120_000,
      sourceAsset: req.intent.currency,
      targetAsset: req.intent.currency,
      sourceAmount: String(req.intent.amount),
      note:
        stripeTestMode() === "stripe_api"
          ? "Stripe API TEST quote"
          : "Local Stripe-test ledger quote (set STRIPE_SECRET_KEY for real TEST API)",
    };
  },
  async reserve(req: SettlementRequest): Promise<RailReserve> {
    if (stripeTestMode() === "disabled") {
      return { ok: false, reserveId: "", rail: "stripe_test", expiresAt: 0 };
    }
    const id = `rsv_stripe_${randomNonce(8)}`;
    ledger.set(id, {
      id,
      intentKey: intentKey(req),
      status: "reserved",
      reservedAt: Date.now(),
      note: "stripe test reserve",
      currency: req.intent.currency,
      amount: String(req.intent.amount),
    });
    return {
      ok: true,
      reserveId: id,
      rail: "stripe_test",
      expiresAt: Date.now() + 300_000,
    };
  },
  async settle(req: SettlementRequest): Promise<SettlementReceipt> {
    const mode = stripeTestMode();
    if (mode === "disabled") {
      return {
        ok: false,
        rail: "stripe_test",
        settlement_id: "",
        routed_at: new Date().toISOString(),
        note: "Stripe TEST disabled in this environment",
      };
    }

    const key = intentKey(req);
    const existing = idempotency.get(key);
    if (existing) {
      const prev = ledger.get(existing);
      if (prev && (prev.status === "settled" || prev.status === "webhook_acked")) {
        return {
          ok: true,
          rail: "stripe_test",
          settlement_id: existing,
          routed_at: new Date().toISOString(),
          note: "Idempotent replay — existing Stripe test settlement",
        };
      }
    }

    const amountCents = Math.max(1, Math.round(Number(req.intent.amount) * 100) || 100);
    const currency = (req.intent.currency || "usd").toLowerCase();

    let stripePaymentIntentId: string | undefined;
    if (mode === "stripe_api") {
      const pi = await stripeFetch("/payment_intents", {
        amount: String(Math.max(50, amountCents)), // Stripe min ~$0.50
        currency: currency === "btc" || currency === "inr" ? "usd" : currency,
        confirm: "true",
        payment_method: "pm_card_visa",
        "payment_method_types[0]": "card",
        description: `Circle universal ${req.intent_commitment.slice(0, 16)}`,
        "metadata[intent_prefix]": key,
        "metadata[circle_pilot]": "stripe_test",
      });
      if (!pi.ok || !pi.id) {
        return {
          ok: false,
          rail: "stripe_test",
          settlement_id: "",
          routed_at: new Date().toISOString(),
          note: `Stripe TEST API failed: ${pi.error || "unknown"}`,
        };
      }
      stripePaymentIntentId = pi.id;
    }

    const settlement_id = stripePaymentIntentId || `stl_stripe_${randomNonce(8)}`;
    ledger.set(settlement_id, {
      id: settlement_id,
      intentKey: key,
      status: "settled",
      settledAt: Date.now(),
      stripePaymentIntentId,
      amount: String(req.intent.amount),
      currency: req.intent.currency,
      note:
        mode === "stripe_api"
          ? `Stripe PaymentIntent ${stripePaymentIntentId} (TEST)`
          : "Local Stripe-test ledger settle — await webhook ack",
    });
    idempotency.set(key, settlement_id);

    return {
      ok: true,
      rail: "stripe_test",
      settlement_id,
      routed_at: new Date().toISOString(),
      note:
        mode === "stripe_api"
          ? `Stripe TEST PaymentIntent ${stripePaymentIntentId}`
          : "Local Stripe-test settle — POST /api/rails/stripe_test/webhook to ack",
    };
  },
  async refund(settlementId: string): Promise<SettlementReceipt> {
    const entry = ledger.get(settlementId);
    if (!entry || (entry.status !== "settled" && entry.status !== "webhook_acked")) {
      return {
        ok: false,
        rail: "stripe_test",
        settlement_id: settlementId,
        routed_at: new Date().toISOString(),
        note: "Refund rejected — settlement not found or not settled",
      };
    }

    if (stripeTestMode() === "stripe_api" && entry.stripePaymentIntentId) {
      const ref = await stripeFetch("/refunds", {
        payment_intent: entry.stripePaymentIntentId,
      });
      if (!ref.ok) {
        return {
          ok: false,
          rail: "stripe_test",
          settlement_id: settlementId,
          routed_at: new Date().toISOString(),
          note: `Stripe refund failed: ${ref.error}`,
        };
      }
    }

    entry.status = "refunded";
    entry.refundedAt = Date.now();
    const refundId = `ref_stripe_${randomNonce(8)}`;
    ledger.set(refundId, { ...entry, id: refundId, status: "refunded" });
    return {
      ok: true,
      rail: "stripe_test",
      settlement_id: refundId,
      routed_at: new Date().toISOString(),
      note: `Refunded ${settlementId}`,
    };
  },
  async status(refId: string): Promise<RailStatusView> {
    const entry = ledger.get(refId);
    if (!entry) {
      return { ok: false, rail: "stripe_test", refId, status: "not_found" };
    }
    return {
      ok: true,
      rail: "stripe_test",
      refId,
      status: entry.status,
      updatedAt: entry.refundedAt || entry.webhookAt || entry.settledAt || entry.reservedAt,
      note: entry.note,
    };
  },
  async reconcile(refId: string): Promise<RailStatusView> {
    return this.status!(refId);
  },
  async handleWebhook(payload: unknown): Promise<RailStatusView> {
    const body = payload as {
      settlement_id?: string;
      id?: string;
      event_id?: string;
      type?: string;
    };
    const eventId = String(body.event_id || body.id || "");
    if (eventId && webhookEvents.has(eventId)) {
      return {
        ok: true,
        rail: "stripe_test",
        refId: String(body.settlement_id || ""),
        status: "duplicate_ignored",
        note: "Duplicate webhook ignored (idempotent)",
      };
    }
    if (eventId) webhookEvents.add(eventId);

    const settlementId = String(body.settlement_id || body.id || "");
    const entry = ledger.get(settlementId);
    if (!entry) {
      return {
        ok: false,
        rail: "stripe_test",
        refId: settlementId,
        status: "not_found",
        note: "Unknown settlement for webhook",
      };
    }
    entry.status = "webhook_acked";
    entry.webhookAt = Date.now();
    entry.note = `${entry.note} · webhook acked`;
    return {
      ok: true,
      rail: "stripe_test",
      refId: settlementId,
      status: "webhook_acked",
      updatedAt: entry.webhookAt,
      note: entry.note,
    };
  },
};

export function resetStripeTestLedger() {
  ledger.clear();
  idempotency.clear();
  webhookEvents.clear();
}

export function exportStripeTestLedger() {
  return {
    ledger: Object.fromEntries(ledger),
    idempotency: Object.fromEntries(idempotency),
    webhookEvents: [...webhookEvents],
  };
}

export function importStripeTestLedger(snap: {
  ledger?: Record<string, unknown>;
  idempotency?: Record<string, string>;
  webhookEvents?: string[];
}) {
  ledger.clear();
  idempotency.clear();
  webhookEvents.clear();
  for (const [k, v] of Object.entries(snap.ledger || {})) {
    ledger.set(k, v as StripeEntry);
  }
  for (const [k, v] of Object.entries(snap.idempotency || {})) {
    idempotency.set(k, v);
  }
  for (const e of snap.webhookEvents || []) webhookEvents.add(e);
}

export function stripeTestOpsSnapshot() {
  const rows = [...ledger.values()];
  return {
    mode: stripeTestMode(),
    hasSecretKey: Boolean(process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_")),
    settlements: rows.filter((r) => r.status === "settled" || r.status === "webhook_acked").length,
    refunds: rows.filter((r) => r.status === "refunded").length,
    webhookAcks: rows.filter((r) => r.status === "webhook_acked").length,
    pendingWebhook: rows.filter((r) => r.status === "settled").length,
  };
}
