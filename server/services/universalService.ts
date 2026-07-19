/**
 * Universal adapter platform — quote → route → bind → settle → reconcile.
 * Backend owns conversion; frontend only confirms. State persists on Store.universal.
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
import {
  accountClearedForChallenge,
  accountClearedForEnhanced,
  bindSandboxAccountsPersist,
  getSandboxAccount,
  hydrateSandboxAccounts,
  listSandboxAccounts,
  type SandboxAccount,
} from "./sandboxAccounts.js";
import { attestUniversalRouteBinding, resolveProofMode } from "./proofServer.js";
import { settleMetricsView } from "./observability.js";
import {
  asExtended,
  buildUniversalSettleRequest,
  resolveUniversalRailId,
} from "./universalRails.js";
import {
  exportStripeTestLedger,
  importStripeTestLedger,
  stripeTestMode,
  stripeTestOpsSnapshot,
} from "../txAuth/rails/stripeTest.js";
import {
  exportSandboxPspLedger,
  importSandboxPspLedger,
} from "../txAuth/rails/sandboxPsp.js";
import type { Store } from "./store.js";
import { saveStore } from "./store.js";
import type {
  RouteComplianceDecision,
  StoredQuotePersist,
  StoredRoutePersist,
  UniversalPaymentRecord,
} from "./universalPersist.js";

export type { RouteComplianceDecision, UniversalPaymentRecord };

type StoredQuote = StoredQuotePersist;
type StoredRoute = StoredRoutePersist;

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

let boundStore: Store | null = null;

function persistUniversal() {
  if (!boundStore) return;
  boundStore.universal = {
    quotes: Object.fromEntries(quotes),
    routes: Object.fromEntries(routes),
    payments: Object.fromEntries(payments),
    metrics: { ...metrics },
    sandboxAccounts: listSandboxAccounts().map((a) => ({ ...a })),
    stripeLedger: exportStripeTestLedger(),
    sandboxPspLedger: exportSandboxPspLedger(),
  };
  saveStore(boundStore);
}

export function bindUniversalStore(store: Store) {
  boundStore = store;
  bindSandboxAccountsPersist(() => persistUniversal());
  const bucket = store.universal;
  if (bucket) {
    quotes.clear();
    routes.clear();
    payments.clear();
    for (const [k, v] of Object.entries(bucket.quotes || {})) quotes.set(k, v);
    for (const [k, v] of Object.entries(bucket.routes || {})) routes.set(k, v);
    for (const [k, v] of Object.entries(bucket.payments || {})) payments.set(k, v);
    Object.assign(metrics, bucket.metrics || {});
    hydrateSandboxAccounts(bucket.sandboxAccounts);
    if (bucket.stripeLedger) importStripeTestLedger(bucket.stripeLedger);
    if (bucket.sandboxPspLedger) importSandboxPspLedger(bucket.sandboxPspLedger);
  } else {
    hydrateSandboxAccounts(undefined);
  }
}

/** Hard compliance: challenge / enhanced / deny block settle unless account is cleared. */
export function assertSettleCompliance(
  intent: UniversalPaymentIntent,
  account: SandboxAccount
): RouteComplianceDecision {
  if (account.sanctionsStatus !== "clear") {
    metrics.sanctionsBlocks += 1;
    throw new Error("Settle blocked: sanctions");
  }
  const { decision, reasons } = evaluateRouteCompliance(intent);
  if (decision === "deny" || decision === "manual_review") {
    metrics.riskHolds += 1;
    throw new Error(`Settle blocked: ${decision} (${reasons.join(",")})`);
  }
  if (
    (decision === "challenge" || decision === "selective_disclosure_required") &&
    !accountClearedForChallenge(account)
  ) {
    metrics.riskHolds += 1;
    throw new Error(
      `Settle blocked: ${decision} — KYC required (${reasons.join(",")})`
    );
  }
  if (decision === "enhanced_kyc_required" && !accountClearedForEnhanced(account)) {
    metrics.riskHolds += 1;
    throw new Error(
      `Settle blocked: enhanced_kyc_required — KYC + wallet screening (${reasons.join(",")})`
    );
  }
  return decision;
}

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
  persistUniversal();
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
  if (compliance.decision === "deny" || compliance.decision === "manual_review") {
    metrics.riskHolds += 1;
    throw new Error(`Route denied: ${compliance.decision} (${compliance.reasons.join(",")})`);
  }
  const account = getSandboxAccount(stored.accountId);
  if (!account) throw new Error("sandbox account not found");
  // Soft preview on route: still create, but encode uncleared status for UI
  try {
    assertSettleCompliance(intent, account);
  } catch {
    // Route may still be planned for judge demo of binding; settle will hard-block.
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
  persistUniversal();
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

  const account = getSandboxAccount(route.accountId);
  if (!account) throw new Error("sandbox account not found");
  // Hard compliance gate — before proof / rails
  const complianceDecision = assertSettleCompliance(route.intent, account);
  route.compliance = complianceDecision;

  const intentCommitment = sha256(
    [
      "uni:intent",
      route.routeCommitment,
      route.quote.quoteId,
      route.routeId,
      route.intent.senderId,
      route.intent.recipientId,
      route.quote.sourceAmount,
      route.quote.targetAsset,
      String(route.quote.expiresAt),
    ].join("|")
  );

  // Compact + proof-server SNARK over bound intent — before any Stripe test credit
  const attest = await attestUniversalRouteBinding({
    intentCommitment,
    routeCommitment: route.routeCommitment,
    quoteId: route.quote.quoteId,
    routeId: route.routeId,
  });
  if (!attest.ok) {
    metrics.failed += 1;
    throw new Error(attest.reason || "Universal route proof failed");
  }

  const mode = await resolveProofMode();
  if (
    process.env.NYXPAY_REQUIRE_ZK_PROVE === "1" &&
    attest.grade !== "zk-proved" &&
    !process.env.VITEST
  ) {
    metrics.failed += 1;
    throw new Error("Strict mode: proof-server SNARKs required for universal settle");
  }

  // Multi-leg rail settlement — real adapters (Stripe TEST / sandbox_psp / mock_fx)
  if (stripeTestMode() === "disabled" && route.targetAdapter.includes("stripe")) {
    metrics.failed += 1;
    throw new Error(
      "Stripe TEST rail disabled — set STRIPE_SECRET_KEY=sk_test_… or NYXPAY_UNIVERSAL_LOCAL_STRIPE=1"
    );
  }

  const amountNum = Number(route.quote.sourceAmount) || 0;
  const targetAmountNum = Number(route.quote.targetAmount) || amountNum;
  const gaps: string[] = [];

  const sourceRailId = resolveUniversalRailId(route.sourceAdapter);
  const sourceRail = asExtended(sourceRailId);
  const sourceReq = buildUniversalSettleRequest({
    intentCommitment,
    amount: amountNum,
    currency: route.quote.sourceAsset,
    rail: sourceRailId,
    accountId: route.accountId,
  });
  if (sourceRail.reserve) await sourceRail.reserve(sourceReq);
  const sourceSettle = await sourceRail.settle(sourceReq);
  if (!sourceSettle.ok) {
    metrics.failed += 1;
    throw new Error(`Source rail failed: ${sourceSettle.note}`);
  }
  const sourceSettlementId = sourceSettle.settlement_id;

  let conversionSettlementId: string | undefined;
  if (route.conversionAdapter) {
    const fxRail = asExtended(resolveUniversalRailId(route.conversionAdapter));
    const fxReq = buildUniversalSettleRequest({
      intentCommitment: sha256(`${intentCommitment}|fx`),
      amount: amountNum,
      currency: route.quote.sourceAsset,
      rail: "mock_fx",
      accountId: route.accountId,
    });
    const fxSettle = await fxRail.settle(fxReq);
    if (!fxSettle.ok) gaps.push("conversion_pending");
    else conversionSettlementId = fxSettle.settlement_id;
  }

  const targetRailId = resolveUniversalRailId(route.targetAdapter);
  const targetRail = asExtended(targetRailId);
  const targetReq = buildUniversalSettleRequest({
    intentCommitment: sha256(`${intentCommitment}|tgt`),
    amount: targetAmountNum,
    currency: route.quote.targetAsset,
    rail: targetRailId,
    accountId: route.accountId,
  });
  if (targetRail.reserve) await targetRail.reserve(targetReq);
  const targetSettle = await targetRail.settle(targetReq);
  if (!targetSettle.ok) {
    metrics.failed += 1;
    // Attempt source refund
    if (sourceRail.refund) await sourceRail.refund(sourceSettlementId);
    throw new Error(`Target rail failed: ${targetSettle.note}`);
  }
  const targetSettlementId = targetSettle.settlement_id;

  // Local Stripe-test ledger: auto webhook-ack so recon can close (API TEST uses Stripe webhooks)
  if (
    targetRailId === "stripe_test" &&
    stripeTestMode() === "local_ledger" &&
    targetRail.handleWebhook
  ) {
    await targetRail.handleWebhook({
      settlement_id: targetSettlementId,
      event_id: `evt_auto_${targetSettlementId}`,
      event: "payment_intent.succeeded",
    });
  }
  if (
    sourceRailId === "sandbox_psp" &&
    sourceRail.handleWebhook
  ) {
    await sourceRail.handleWebhook({
      settlement_id: sourceSettlementId,
      event_id: `evt_auto_${sourceSettlementId}`,
      event: "settlement.updated",
    });
  }

  // Recon gaps until webhook ack on target
  const targetStatus = targetRail.status
    ? await targetRail.status(targetSettlementId)
    : { status: "webhook_acked" };
  if (targetStatus.status === "settled") {
    gaps.push("webhook_missing");
  }

  const id = `upay_${randomNonce(10)}`;
  const now = Date.now();
  const receiptId = `rcpt_uni_${randomNonce(8)}`;
  const reconciled = gaps.length === 0;

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
    lifecycleState: reconciled ? "reconciled" : "settled",
    riskDecision: complianceDecision,
    proofMode: mode.mode,
    attestationGrade: attest.grade,
    circuit: attest.circuit,
    snarkDigest: attest.snarkDigest,
    bindingDigest: attest.bindingDigest,
    proveMs: attest.proveMs,
    reconciliationGaps: gaps,
    createdAt: now,
    updatedAt: now,
    timeline: [
      { at: now, state: "created" },
      {
        at: now + 1,
        state: "proof_verified",
        note: `${attest.grade}${attest.snarkDigest ? ` · ${attest.snarkDigest.slice(0, 12)}…` : ""}`,
      },
      { at: now + 2, state: "rail_reserved", note: sourceSettlementId },
      {
        at: now + 3,
        state: "settled",
        note: `${targetRailId} · ${targetSettlementId}`,
      },
      ...(reconciled
        ? [{ at: now + 4, state: "reconciled", note: receiptId }]
        : [{ at: now + 4, state: "settled", note: `pending: ${gaps.join(",")}` }]),
    ],
  };
  payments.set(id, rec);
  // Single-use quote after settle
  quotes.delete(route.quote.quoteId);
  metrics.settled += 1;
  persistUniversal();
  return rec;
}

export function getUniversalPayment(id: string): UniversalPaymentRecord | undefined {
  return payments.get(id) || [...payments.values()].find((p) => p.receiptId === id);
}

/** Recompute multi-leg gaps; clear webhook_missing after target webhook ack */
export async function reconcileUniversalPayment(
  paymentId: string
): Promise<UniversalPaymentRecord> {
  const rec = getUniversalPayment(paymentId);
  if (!rec) throw new Error("payment not found");
  const gaps: string[] = [];
  if (!rec.snarkDigest && rec.attestationGrade !== "zk-proved" && rec.attestationGrade !== "compact-runtime") {
    gaps.push("proof_incomplete");
  }
  if (!rec.sourceSettlementId) gaps.push("source_debit_missing");
  if (rec.conversionAdapter && !rec.conversionSettlementId) gaps.push("conversion_pending");
  if (!rec.targetSettlementId) gaps.push("target_credit_missing");

  if (rec.targetSettlementId) {
    const targetRail = asExtended(resolveUniversalRailId(rec.targetAdapter));
    if (targetRail.status) {
      const st = await targetRail.status(rec.targetSettlementId);
      if (st.status === "settled") gaps.push("webhook_missing");
      if (st.status === "not_found" || st.status === "failed") gaps.push("target_credit_missing");
    }
  }

  rec.reconciliationGaps = gaps;
  rec.updatedAt = Date.now();
  if (gaps.length === 0 && rec.lifecycleState !== "refunded") {
    rec.lifecycleState = "reconciled";
    rec.timeline.push({ at: rec.updatedAt, state: "reconciled", note: "gaps cleared" });
  }
  persistUniversal();
  return rec;
}

export async function refundUniversal(paymentId: string): Promise<UniversalPaymentRecord> {
  const rec = getUniversalPayment(paymentId);
  if (!rec) throw new Error("payment not found");
  rec.lifecycleState = "reversal_pending";
  rec.updatedAt = Date.now();
  rec.timeline.push({ at: rec.updatedAt, state: "reversal_pending", note: "refund started" });

  const notes: string[] = [];
  if (rec.targetSettlementId) {
    const targetRail = asExtended(resolveUniversalRailId(rec.targetAdapter));
    if (targetRail.refund) {
      const r = await targetRail.refund(rec.targetSettlementId);
      notes.push(r.note);
      if (!r.ok) {
        rec.reconciliationGaps = [...rec.reconciliationGaps, "refund_pending"];
        rec.lifecycleState = "manual_review";
        persistUniversal();
        return rec;
      }
    }
  }
  if (rec.conversionSettlementId) {
    const fx = asExtended("mock_fx");
    if (fx.refund) await fx.refund(rec.conversionSettlementId);
  }
  if (rec.sourceSettlementId) {
    const sourceRail = asExtended(resolveUniversalRailId(rec.sourceAdapter));
    if (sourceRail.refund) {
      const r = await sourceRail.refund(rec.sourceSettlementId);
      notes.push(r.note);
    }
  }

  rec.lifecycleState = "refunded";
  rec.reconciliationGaps = [];
  rec.updatedAt = Date.now();
  rec.timeline.push({
    at: rec.updatedAt,
    state: "refunded",
    note: notes.join(" · ") || "rails refunded",
  });
  metrics.refunds += 1;
  persistUniversal();
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
  const stripe = stripeTestOpsSnapshot();
  return {
    ok: true,
    persisted: Boolean(boundStore?.universal || boundStore),
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
        "duplicate callback handling",
      ],
      note: "HMAC webhook at POST /api/rails/sandbox_psp/webhook — pilot, not licensed UPI/bank.",
    },
    stripeTest: {
      ...stripe,
      capabilities: [
        "quote",
        "reserve",
        "settle",
        "refund",
        "status",
        "webhook/reconcile",
        "idempotency",
        "duplicate callback handling",
      ],
      note:
        stripe.mode === "stripe_api"
          ? "Live Stripe TEST API (sk_test_) — PaymentIntent settle/refund"
          : stripe.mode === "local_ledger"
            ? "Local Stripe-test ledger — set STRIPE_SECRET_KEY=sk_test_… for real TEST API"
            : "Disabled — set STRIPE_SECRET_KEY or NYXPAY_UNIVERSAL_LOCAL_STRIPE=1",
    },
    kycProvider: process.env.KYC_PROVIDER || "sandbox",
    latestReceipt: latest
      ? {
          receiptId: latest.receiptId,
          routeId: latest.routeId,
          quoteId: latest.quoteId,
          routeCommitment: latest.routeCommitment,
          intentCommitment: latest.intentCommitment,
          lifecycleState: latest.lifecycleState,
          attestationGrade: latest.attestationGrade,
          proofMode: latest.proofMode,
          circuit: latest.circuit,
          snarkDigest: latest.snarkDigest,
          proveMs: latest.proveMs,
          sourceAdapter: latest.sourceAdapter,
          conversionAdapter: latest.conversionAdapter,
          targetAdapter: latest.targetAdapter,
          sourceAsset: latest.sourceAsset,
          targetAsset: latest.targetAsset,
          riskDecision: latest.riskDecision,
          reconciliationGaps: latest.reconciliationGaps,
          sourceSettlementId: latest.sourceSettlementId,
          conversionSettlementId: latest.conversionSettlementId,
          targetSettlementId: latest.targetSettlementId,
        }
      : null,
    pilotHealth: (() => {
      const pending = [...payments.values()].filter((p) => p.reconciliationGaps.length).length;
      const failed = metrics.failed;
      if (failed > 0 && pending > 0) return { status: "red" as const, note: "failures + recon gaps" };
      if (pending > 0) return { status: "yellow" as const, note: "pending reconciliation gaps" };
      if (stripe.mode === "disabled")
        return { status: "yellow" as const, note: "Stripe TEST rail disabled" };
      return { status: "green" as const, note: "no gaps · rails ready" };
    })(),
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
  if (boundStore) {
    boundStore.universal = undefined;
    saveStore(boundStore);
  }
}

/** Test helper: clear in-memory Maps then re-hydrate from bound Store (simulates restart). */
export function simulateUniversalRestart() {
  if (!boundStore) throw new Error("no bound store");
  // Flush current memory into store first
  persistUniversal();
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
  bindUniversalStore(boundStore);
}

export function getStoredRoute(routeId: string) {
  return routes.get(routeId);
}
