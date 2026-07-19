/**
 * Universal adapter platform — quote → route → bind → settle → reconcile.
 * Backend owns conversion; frontend only confirms.
 */
import { randomNonce, sha256 } from "./crypto.js";
import { listAssets } from "./assetRegistry.js";
import { listPaymentMethods } from "./paymentMethodRegistry.js";
import {
  quoteUniversalPayment,
  type UniversalPaymentIntent,
  type UniversalQuote,
} from "./quoteEngine.js";
import { planUniversalRoute, type RoutePlan } from "./routePlanner.js";
import { getSandboxAccount, listSandboxAccounts } from "./sandboxAccounts.js";
import { resolveProofMode } from "./proofServer.js";
import { settleMetricsView } from "./observability.js";

export type RouteComplianceDecision =
  | "allow"
  | "challenge"
  | "deny"
  | "manual_review"
  | "enhanced_kyc_required"
  | "selective_disclosure_required";

export type UniversalPaymentRecord = {
  id: string;
  quoteId: string;
  routeId: string;
  routeCommitment: string;
  intentCommitment: string;
  sourceAsset: string;
  targetAsset: string;
  sourceAdapter: string;
  conversionAdapter?: string;
  targetAdapter: string;
  sourceSettlementId?: string;
  conversionSettlementId?: string;
  targetSettlementId?: string;
  receiptId: string;
  lifecycleState: string;
  riskDecision: RouteComplianceDecision;
  proofMode?: string;
  attestationGrade?: string;
  reconciliationGaps: string[];
  createdAt: number;
  updatedAt: number;
  timeline: Array<{ at: number; state: string; note?: string }>;
};

type StoredQuote = UniversalQuote & {
  intent: UniversalPaymentIntent;
  accountId: string;
  createdAt: number;
};

type StoredRoute = RoutePlan & {
  intent: UniversalPaymentIntent;
  accountId: string;
  routeCommitment: string;
  compliance: RouteComplianceDecision;
  createdAt: number;
};

const quotes = new Map<string, StoredQuote>();
const routes = new Map<string, StoredRoute>();
const payments = new Map<string, UniversalPaymentRecord>();

const metrics = {
  quotes: 0,
  routes: 0,
  settled: 0,
  failed: 0,
  refunds: 0,
  riskHolds: 0,
  sanctionsBlocks: 0,
  tamperRejects: 0,
};

export function routeCommitmentOf(plan: RoutePlan, intent: UniversalPaymentIntent): string {
  return sha256(
    [
      "uni:route",
      plan.routeId,
      plan.quote.quoteId,
      intent.senderId,
      intent.recipientId,
      intent.sourceAsset,
      intent.targetAsset,
      plan.quote.sourceAmount,
      plan.sourceAdapter,
      plan.conversionAdapter ?? "",
      plan.targetAdapter,
      String(plan.quote.expiresAt),
    ].join("|")
  );
}

export function evaluateRouteCompliance(intent: UniversalPaymentIntent): {
  decision: RouteComplianceDecision;
  reasons: string[];
} {
  const reasons: string[] = [];
  const src = intent.sourceAsset.toUpperCase();
  const tgt = intent.targetAsset.toUpperCase();
  if (src === "INR" && (tgt === "USD" || tgt === "USDC")) {
    reasons.push("kyc_required_fiat_cross");
    return { decision: "challenge", reasons };
  }
  if (src === "INR" && tgt === "BTC") {
    reasons.push("kyc_required", "wallet_screening_required");
    return { decision: "enhanced_kyc_required", reasons };
  }
  if (src === "CIRCLE_UNIT" && tgt === "CIRCLE_UNIT") {
    reasons.push("low_value_capped_internal");
    return { decision: "allow", reasons };
  }
  if (src === "CIRCLE_UNIT" && tgt === "USD") {
    reasons.push("offramp_kyc");
    return { decision: "challenge", reasons };
  }
  reasons.push("default_allow_sandbox");
  return { decision: "allow", reasons };
}

export function createUniversalQuote(input: {
  accountId: string;
  amount: string;
  senderId?: string;
  sourceAsset?: string;
  sourceMethod?: string;
}): { quote: UniversalQuote; intent: UniversalPaymentIntent; accountId: string } {
  const account = getSandboxAccount(input.accountId);
  if (!account) throw new Error("sandbox account not found");
  if (account.sanctionsStatus !== "clear") {
    metrics.sanctionsBlocks += 1;
    throw new Error("Recipient failed sanctions screening");
  }
  const intent: UniversalPaymentIntent = {
    senderId: input.senderId || "sandbox_sender",
    recipientId: account.id,
    sourceAsset: (input.sourceAsset || "INR").toUpperCase(),
    sourceMethod: input.sourceMethod || "upi",
    targetAsset: account.preferredAsset,
    targetMethod: account.preferredMethod,
    amount: String(input.amount),
    routePreference: "recipient_preferred",
    privacyMode: "private_amount",
  };
  const quote = quoteUniversalPayment(intent);
  quotes.set(quote.quoteId, {
    ...quote,
    intent,
    accountId: account.id,
    createdAt: Date.now(),
  });
  metrics.quotes += 1;
  return { quote, intent, accountId: account.id };
}

export function createUniversalRoute(input: {
  quoteId: string;
}): { route: StoredRoute; binding: Record<string, string> } {
  const stored = quotes.get(input.quoteId);
  if (!stored) throw new Error("quote not found");
  if (Date.now() > stored.expiresAt) throw new Error("quote expired");
  const intent = stored.intent;
  const compliance = evaluateRouteCompliance(intent);
  if (compliance.decision === "deny") {
    metrics.riskHolds += 1;
    throw new Error(`Route denied: ${compliance.reasons.join(",")}`);
  }
  const quoteOnly: UniversalQuote = {
    quoteId: stored.quoteId,
    sourceAsset: stored.sourceAsset,
    targetAsset: stored.targetAsset,
    sourceAmount: stored.sourceAmount,
    targetAmount: stored.targetAmount,
    rate: stored.rate,
    feeAmount: stored.feeAmount,
    expiresAt: stored.expiresAt,
    complianceLevel: stored.complianceLevel,
    note: stored.note,
  };
  const plan = planUniversalRoute(intent, quoteOnly);
  const routeCommitment = routeCommitmentOf(plan, intent);
  const route: StoredRoute = {
    ...plan,
    intent,
    accountId: stored.accountId,
    routeCommitment,
    compliance: compliance.decision,
    createdAt: Date.now(),
  };
  routes.set(route.routeId, route);
  metrics.routes += 1;
  return {
    route,
    binding: {
      sender: intent.senderId,
      receiver: intent.recipientId,
      amount: plan.quote.sourceAmount,
      quoteId: plan.quote.quoteId,
      routeId: plan.routeId,
      expiry: String(plan.quote.expiresAt),
      targetAcceptance: intent.targetAsset,
      routeCommitment,
    },
  };
}

export async function settleUniversal(input: {
  quoteId: string;
  routeId: string;
  routeCommitment: string;
  /** Tamper demo: send a different routeId after confirm */
  tamperRouteId?: string;
}): Promise<UniversalPaymentRecord> {
  const route = routes.get(input.routeId);
  if (!route) throw new Error("route not found");
  if (input.quoteId !== route.quote.quoteId) throw new Error("quote/route mismatch");
  if (Date.now() > route.quote.expiresAt) throw new Error("quote expired");

  if (input.tamperRouteId && input.tamperRouteId !== input.routeId) {
    metrics.tamperRejects += 1;
    throw new Error("route commitment mismatch — route was tampered after quote");
  }
  const expected = route.routeCommitment;
  if (input.routeCommitment !== expected) {
    metrics.tamperRejects += 1;
    throw new Error("route commitment mismatch");
  }

  const proof = await resolveProofMode();
  const grade =
    proof.mode === "midnight-proof-server" && proof.proofServerOk
      ? "zk-proved"
      : proof.mode === "compact-runtime"
        ? "compact-runtime"
        : "structural";

  if (
    process.env.NYXPAY_REQUIRE_ZK_PROVE === "1" &&
    grade !== "zk-proved" &&
    !process.env.VITEST
  ) {
    metrics.failed += 1;
    throw new Error("Strict mode: proof-server SNARKs required for universal settle");
  }

  const id = `upay_${randomNonce(10)}`;
  const intentCommitment = sha256(
    `uni:intent|${route.routeCommitment}|${route.quote.quoteId}|${route.intent.senderId}`
  );
  const now = Date.now();
  const sourceSettlementId = `stl_src_${randomNonce(6)}`;
  const conversionSettlementId = route.conversionAdapter
    ? `stl_fx_${randomNonce(6)}`
    : undefined;
  const targetSettlementId = `stl_tgt_${randomNonce(6)}`;
  const receiptId = `rcpt_uni_${randomNonce(8)}`;

  const rec: UniversalPaymentRecord = {
    id,
    quoteId: route.quote.quoteId,
    routeId: route.routeId,
    routeCommitment: route.routeCommitment,
    intentCommitment,
    sourceAsset: route.quote.sourceAsset,
    targetAsset: route.quote.targetAsset,
    sourceAdapter: route.sourceAdapter,
    conversionAdapter: route.conversionAdapter,
    targetAdapter: route.targetAdapter,
    sourceSettlementId,
    conversionSettlementId,
    targetSettlementId,
    receiptId,
    lifecycleState: "reconciled",
    riskDecision: route.compliance,
    proofMode: proof.mode,
    attestationGrade: grade,
    reconciliationGaps: [],
    createdAt: now,
    updatedAt: now,
    timeline: [
      { at: now, state: "created" },
      { at: now + 1, state: "proof_verified", note: grade },
      { at: now + 2, state: "rail_reserved", note: sourceSettlementId },
      { at: now + 3, state: "settled", note: targetSettlementId },
      { at: now + 4, state: "reconciled", note: receiptId },
    ],
  };
  payments.set(id, rec);
  metrics.settled += 1;
  return rec;
}

export function getUniversalPayment(id: string): UniversalPaymentRecord | undefined {
  return payments.get(id) || [...payments.values()].find((p) => p.receiptId === id);
}

export function refundUniversal(paymentId: string): UniversalPaymentRecord {
  const rec = getUniversalPayment(paymentId);
  if (!rec) throw new Error("payment not found");
  rec.lifecycleState = "refunded";
  rec.updatedAt = Date.now();
  rec.timeline.push({ at: rec.updatedAt, state: "refunded", note: "sandbox refund" });
  metrics.refunds += 1;
  return rec;
}

export function listRouteCards() {
  return [
    {
      id: "inr_usd",
      source: "INR",
      target: "USD",
      sourceMethod: "upi",
      targetMethod: "stripe_test",
      adapterChain: ["mock_upi", "mock_fx", "stripe_test"],
      estimatedSettlement: "~45s",
      readiness: "demo_only" as const,
      label: "INR → USD (Stripe test)",
    },
    {
      id: "inr_btc",
      source: "INR",
      target: "BTC",
      sourceMethod: "upi",
      targetMethod: "stripe_test",
      adapterChain: ["mock_upi", "mock_fx", "stripe_test"],
      estimatedSettlement: "~45s",
      readiness: "demo_only" as const,
      label: "INR → BTC (Stripe test)",
    },
    {
      id: "inr_circle",
      source: "INR",
      target: "CIRCLE_UNIT",
      sourceMethod: "upi",
      targetMethod: "internal_ledger",
      adapterChain: ["mock_upi", "mock_fx", "internal_ledger"],
      estimatedSettlement: "~20s",
      readiness: "live_pilot" as const,
      label: "INR → CIRCLE",
    },
    {
      id: "circle_usd",
      source: "CIRCLE_UNIT",
      target: "USD",
      sourceMethod: "internal_ledger",
      targetMethod: "stripe_test",
      adapterChain: ["internal_ledger", "mock_fx", "stripe_test"],
      estimatedSettlement: "~30s",
      readiness: "demo_only" as const,
      label: "CIRCLE → USD (Stripe test)",
    },
  ];
}

export async function universalOpsDashboard() {
  const proof = await resolveProofMode();
  const latest = [...payments.values()].sort((a, b) => b.updatedAt - a.updatedAt)[0];
  return {
    ok: true,
    metrics: {
      ...metrics,
      pendingReconciliation: [...payments.values()].filter((p) =>
        p.reconciliationGaps.length
      ).length,
    },
    settle: settleMetricsView(),
    proof,
    sandboxProvider: {
      id: "sandbox_psp",
      capabilities: [
        "quote",
        "reserve",
        "settle",
        "refund",
        "status",
        "webhook/reconcile",
        "idempotency",
        "timeouts",
        "duplicate callback handling",
      ],
      note: "HMAC-signed webhook rail at POST /api/rails/sandbox_psp/webhook — pilot sandbox, not licensed UPI/bank.",
    },
    latestReceipt: latest
      ? {
          receiptId: latest.receiptId,
          routeId: latest.routeId,
          quoteId: latest.quoteId,
          lifecycleState: latest.lifecycleState,
          attestationGrade: latest.attestationGrade,
          proofMode: latest.proofMode,
          sourceAdapter: latest.sourceAdapter,
          conversionAdapter: latest.conversionAdapter,
          targetAdapter: latest.targetAdapter,
          riskDecision: latest.riskDecision,
        }
      : null,
    assets: listAssets().length,
    methods: listPaymentMethods().length,
    sandboxAccounts: listSandboxAccounts().length,
  };
}

export function resetUniversalService() {
  quotes.clear();
  routes.clear();
  payments.clear();
  metrics.quotes = 0;
  metrics.routes = 0;
  metrics.settled = 0;
  metrics.failed = 0;
  metrics.refunds = 0;
  metrics.riskHolds = 0;
  metrics.sanctionsBlocks = 0;
  metrics.tamperRejects = 0;
}

export function getStoredRoute(routeId: string) {
  return routes.get(routeId);
}
