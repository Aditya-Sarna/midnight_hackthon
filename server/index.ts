import express from "express";
import type { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { assertProductionBoot, loadConfig } from "./config.js";
import { randomNonce } from "./services/crypto.js";
import {
  createPublicAccount,
  issueKyc,
  loadStore,
  publicUser,
  saveStore,
} from "./services/store.js";
import { settlePublicPayment, claimNote } from "./services/payments.js";
import {
  getVaultMeta,
  provisionCloudVaultMeta,
  releaseSharesForRecovery,
} from "./services/vault.js";
import { publicLedger } from "./services/relay.js";
import type { PolicyTemplateId } from "./services/policy.js";
import {
  initMidnightFoundation,
  probeMidnightFoundation,
} from "./services/midnight.js";
import { resolveProofMode, warmProverKeys } from "./services/proofServer.js";
import { createRateLimitStore } from "./services/rateLimitRedis.js";
import { pubkeyThumbprint, verifyEcdsaSignature } from "./services/keys.js";
import {
  complianceDocument,
  createComplianceStack,
} from "./compliance/index.js";
import {
  issueChallenge,
  verifyAndBurn,
  verifyPaymentSessionAuth,
  nyxproofDocument,
} from "./services/nyxproof.js";
import { SANCTIONS_RESCREEN_MS } from "./compliance/posture.js";
import { readCompactLedger } from "./services/compactLedger.js";
import { deployStatus } from "./services/onchain.js";
import { sha256 } from "./services/crypto.js";
import { railsHubDocument } from "./services/railsHub.js";
import { assetRegistryDocument } from "./services/assetRegistry.js";
import { paymentMethodRegistryDocument } from "./services/paymentMethodRegistry.js";
import {
  createSandboxAccount,
  listSandboxAccounts,
  verifySandboxAccount,
} from "./services/sandboxAccounts.js";
import {
  bindUniversalStore,
  createUniversalQuote,
  createUniversalRoute,
  getLastTestnetWitness,
  getUniversalPayment,
  listRouteCards,
  refundUniversal,
  settleUniversal,
  reconcileUniversalPayment,
  universalOpsDashboard,
} from "./services/universalService.js";
import {
  getReceiverBalance,
  getSandboxSender,
  listSandboxSenders,
  resetSandboxLedger,
} from "./services/sandboxLedger.js";
import { testnetProofSnapshot } from "./services/testnetProof.js";
import {
  listPaymentLifecycleForUser,
  publicReceiptView,
  getPaymentLifecycle,
} from "./services/paymentLifecycle.js";
import { reconcilePayment, reconciliationSummary } from "./services/reconciliation.js";
import { settleMetricsView, logStructured } from "./services/observability.js";
import { resolveRailAdapter } from "./txAuth/rails/registry.js";
import {
  advanceDispute,
  listDisputes,
  openDispute,
  type DisputeStatus,
} from "./services/disputes.js";
import {
  creditComplianceDocument,
  furnishCreditBureauReport,
} from "./credit/compliance.js";
import {
  borrowFromPool,
  creditSkillDocument,
  depositToPool,
  getCreditStatus,
  issueCreditIdentity,
  liquidateIfDue,
  listBorrowerLoans,
  previewBorrowDeals,
  previewBorrowDisclosure,
  proveStanding,
  repayLoan,
} from "./credit/service.js";
import {
  ensureDemoBrandRegistries,
  issueMerchantChallenge,
  listBrandRegistries,
  revokeMerchant,
  skillDocument,
  verifyMerchantPayment,
} from "./services/verifiedMerchant.js";
import {
  catalogStats,
  classifyRecipient,
  ensureRegisteredBrandsInRegistry,
  loadBrandsCatalog,
} from "./services/brandsCatalog.js";
import {
  authorizeIntent,
  commitIntent,
  ensureDemoMerchants,
  generateAuthorizedTxProof,
  issueChallenge as issueTxAuthChallenge,
  metricsView,
  revokeMerchant as revokeTxAuthMerchant,
  runAuthorizeWorkflow,
  settleVerifiedTransaction,
  skillDocument as txAuthSkillDocument,
  syncRegistry,
  txAuthState,
  verifyAuthorizedTransaction,
} from "./txAuth/index.js";
import {
  creditPrivateBalance,
  issueSettlementConfirmation,
  listUnmatched,
  mintDestination,
  observeInbound,
  reconcileByOrderRef,
  resolveBuyerPaymentState,
  runReceiveWorkflow,
  skillDocument as receivePaySkillDocument,
  verifySettlementConfirmation,
} from "./receivePay/index.js";
import { listRailAdapters } from "./txAuth/rails/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const cfg = loadConfig();
assertProductionBoot();
const PORT = cfg.port;

app.disable("x-powered-by");
app.use(
  helmet({
    contentSecurityPolicy: cfg.isProduction
      ? {
          useDefaults: true,
          directives: {
            "default-src": ["'self'"],
            "script-src": ["'self'"],
            "style-src": ["'self'", "'unsafe-inline'"],
            "img-src": ["'self'", "data:", "blob:", "https://logo.clearbit.com"],
            "font-src": ["'self'", "data:"],
            "media-src": ["'self'", "blob:", "mediastream:"],
            // Chrome Web Speech reaches Google speech endpoints
            "connect-src": [
              "'self'",
              "https://www.google.com",
              "https://www.gstatic.com",
              "https://*.googleapis.com",
              "wss://*.google.com",
            ],
            "worker-src": ["'self'", "blob:"],
            "frame-ancestors": ["'none'"],
            "base-uri": ["'self'"],
            "form-action": ["'self'"],
            "object-src": ["'none'"],
          },
        }
      : false,
    crossOriginEmbedderPolicy: false,
  })
);
// Mic for Web Speech voice pay (helmet v8 has no permissionsPolicy helper)
app.use((_req, res, next) => {
  res.setHeader("Permissions-Policy", "microphone=(self), camera=(), geolocation=()");
  next();
});
app.use(
  cors({
    origin:
      cfg.corsOrigins === "*"
        ? true
        : (origin, cb) => {
            if (!origin || cfg.corsOrigins.includes(origin)) cb(null, true);
            else cb(new Error("CORS blocked"));
          },
    credentials: true,
  })
);
app.use(express.json({ limit: "512kb" }));
{
  const windowMs = 60_000;
  app.use(
    rateLimit({
      windowMs,
      max: cfg.isStrict ? 120 : 180,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: "Rate limit exceeded" },
      // Redis when REDIS_URL is set; otherwise in-process memory
      store: createRateLimitStore(windowMs),
    })
  );
}

/** Skill / agent routes require API_SKILL_TOKEN in production, or when configured */
function requireSkillToken(req: Request, res: Response, next: NextFunction) {
  if (!cfg.skillApiToken) {
    if (cfg.isProduction) {
      return res.status(503).json({ error: "Skills API locked — set API_SKILL_TOKEN" });
    }
    return next();
  }
  const hdr = req.get("authorization") || "";
  const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : req.get("x-api-token");
  if (token !== cfg.skillApiToken) {
    return res.status(401).json({ error: "Unauthorized — invalid API_SKILL_TOKEN" });
  }
  next();
}
app.use("/api/skills", requireSkillToken);

const midnightBoot = initMidnightFoundation("preprod");
console.log(
  `Circle · Midnight network=${midnightBoot.networkId} · Class0=device-only · strict=${cfg.isStrict}`
);

const store = loadStore();
bindUniversalStore(store);
const allowDemoSeed =
  !cfg.isProduction ||
  process.env.NYXPAY_ALLOW_DEMO_SEED === "1" ||
  process.env.NYXPAY_BOOT_SOFT === "1" ||
  Boolean(process.env.VITEST);
if (allowDemoSeed) {
  ensureDemoBrandRegistries(store);
  ensureDemoMerchants(store);
}
ensureRegisteredBrandsInRegistry(store);
const compliance = createComplianceStack(store);

function findUser(id: string) {
  return store.users.find((u) => u.id === id);
}

async function handleSettle(req: Request, res: Response, userId: string) {
  const user = findUser(userId);
  if (!user) return res.status(404).json({ error: "User not found" });

  const body = req.body ?? {};
  if (!body.intentCommitment || !body.signature || !body.spendNullifier) {
    return res.status(400).json({
      error: "Client must submit intentCommitment, signature, proofs, and commitment updates",
    });
  }

  const verified = compliance.proofVerification.verify({
    recipientProof: body.recipientProof,
    policyProof: body.policyProof,
    spendProof: body.spendProof,
    nullifier: body.spendNullifier,
    spentNullifiers: store.spentNullifiers,
  });
  if (!verified.ok) {
    return res.status(422).json({ ok: false, reason: verified.reason, publicOnly: true });
  }

  if (!body.sessionAuth?.proof || !body.sessionAuthTimeWindow) {
    return res.status(400).json({
      error: "CircleProof sessionAuth required on confirm-tap (OTP replacement)",
    });
  }
  const session = verifyPaymentSessionAuth(store, {
    intentCommitment: String(body.intentCommitment),
    timeWindow: String(body.sessionAuthTimeWindow),
    sessionProof: body.sessionAuth,
    credentialCommitment: user.credentialCommitment,
  });
  if (!session.ok) {
    return res.status(422).json({ ok: false, reason: session.reason, nyxproof: true });
  }

  const tw = String(body.sessionAuthTimeWindow);
  const relyingPartyId = `circled:payment:${String(body.intentCommitment)}`;
  const nonce = String(body.intentCommitment).slice(0, 48);
  const challenge = sha256(`nyxproof:challenge:${nonce}|${relyingPartyId}|${tw}`);

  // Session Compact+SNARK runs in parallel with payment Compact+SNARK pipelines
  const result = await settlePublicPayment(
    store,
    user,
    {
      intentCommitment: String(body.intentCommitment),
      signature: String(body.signature),
      spendNullifier: String(body.spendNullifier),
      oldBalanceCommitment: String(body.oldBalanceCommitment),
      newBalanceCommitment: String(body.newBalanceCommitment),
      newPolicyCommitment: String(body.newPolicyCommitment),
      recipientPubkey: String(body.recipientPubkey),
      recipientProof: body.recipientProof,
      policyProof: body.policyProof,
      spendProof: body.spendProof,
      balanceWitness: body.balanceWitness,
      encryptedNote: body.encryptedNote,
      stepUp: body.stepUp
        ? {
            kind: body.stepUp.kind === "biometric" ? "biometric" : "passkey",
            at: body.stepUp.at != null ? Number(body.stepUp.at) : Date.now(),
          }
        : undefined,
    },
    {
      parallelSession: {
        challenge,
        relyingPartyId: sha256(`rp:${relyingPartyId}`),
        timeWindow: sha256(tw),
      },
    }
  );

  if (!result.ok) {
    logStructured("warn", "api.settle.reject", {
      userId: userId.slice(0, 8),
      reason: result.reason,
      paymentId: "paymentId" in result ? result.paymentId : undefined,
    });
    return res.status(422).json({
      ok: false,
      reason: result.reason,
      paymentId: "paymentId" in result ? result.paymentId : undefined,
      nyxproof: result.reason?.toLowerCase().includes("session") ? true : undefined,
    });
  }

  const compactSession = result.sessionAttest;

  compliance.settlementRelay.log("submit", "committed_payload");
  compliance.settlementRelay.flush();

  return res.json({
    ok: true,
    eventId: result.eventId,
    paymentId: result.paymentId,
    correlationId: result.correlationId,
    receiptId: result.receiptId,
    lifecycleState: result.lifecycleState,
    riskDecision: result.riskDecision,
    rail: result.rail,
    delayMs: result.delayMs,
    proofs: result.proofs,
    proofMode: result.proofMode,
    attestationGrade: result.attestationGrade,
    compactProved: result.compactProved,
    snarkDigests: result.snarkDigests,
    proveTimings: result.proveTimings,
    compactLedger: result.compactLedger,
    onchain: result.onchain,
    proofVerification: { ok: true, publicOnly: true, amountPrivate: true },
    nyxproof: {
      sessionAuth: true,
      challengeBurned: true,
      otpReplaced: true,
      compactMode: compactSession?.mode,
      attestationGrade: compactSession?.grade,
      compactProved: compactSession?.proved ?? false,
      snarkDigests: compactSession?.snarkDigests,
    },
    user: publicUser(user),
  });
}

/** Web Push subscription stub (VAPID wiring left to deploy env) */
const pushSubs: { endpoint: string; keys?: Record<string, string>; at: number }[] = [];
app.post("/api/push/subscribe", (req, res) => {
  const endpoint = String(req.body?.endpoint || "");
  if (!endpoint) return res.status(400).json({ error: "endpoint required" });
  pushSubs.push({
    endpoint,
    keys: req.body?.keys && typeof req.body.keys === "object" ? req.body.keys : undefined,
    at: Date.now(),
  });
  res.json({
    ok: true,
    subscribers: pushSubs.length,
    note: "Stub store — set VAPID keys + web-push sender in production",
  });
});

/** Off-ramp stub — mocked withdraw-to-bank (demo money-out) */
app.post("/api/offramp", (req, res) => {
  const amount = Number(req.body?.amount);
  const currency = String(req.body?.currency || "USD").toUpperCase();
  const accountHint = String(req.body?.accountHint || "").trim();
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ error: "amount required" });
  }
  if (accountHint.length < 4) {
    return res.status(400).json({ error: "accountHint required (last-4 / IBAN hint)" });
  }
  res.json({
    ok: true,
    status: "mock_settled",
    reference: `off_${Date.now().toString(36)}`,
    etaMinutes: 1,
    currency,
    amount,
    note: "Stub off-ramp — no real bank rails; completes demo money-out story",
  });
});

/** Rails hub — asset model + rail readiness (honest pilot surface) */
app.get("/api/rails", (_req, res) => {
  res.json(railsHubDocument());
});

app.get("/api/assets", (_req, res) => {
  res.json(assetRegistryDocument());
});

app.get("/api/payment-methods", (_req, res) => {
  res.json(paymentMethodRegistryDocument());
});

app.get("/api/universal/sandbox-accounts", (_req, res) => {
  res.json({ ok: true, accounts: listSandboxAccounts() });
});

// --- Backend-authoritative sandbox ledger + real-testnet witness ---
// See docs/CIRCLED_TRUST_SURFACE.md, docs/CIRCLED_MULTI_PERSONA.md,
// docs/CIRCLED_REALISM_BOUNDARY.md.

app.get("/api/universal/senders", (_req, res) => {
  res.json({ ok: true, senders: listSandboxSenders() });
});

app.get("/api/universal/sender-balance/:id", (req, res) => {
  const s = getSandboxSender(String(req.params.id));
  if (!s) return res.status(404).json({ error: "sender not found" });
  res.json({
    ok: true,
    senderId: s.id,
    displayName: s.displayName,
    asset: s.asset,
    jurisdiction: s.jurisdiction,
    balance: s.balance,
    openingBalance: s.openingBalance,
  });
});

app.get("/api/universal/receiver-balance/:id", (req, res) => {
  const accountId = String(req.params.id);
  const account = listSandboxAccounts().find((a) => a.id === accountId);
  if (!account) return res.status(404).json({ error: "account not found" });
  res.json({
    ok: true,
    accountId,
    asset: account.preferredAsset,
    balance: getReceiverBalance(accountId),
  });
});

app.post("/api/universal/reset-balances", (_req, res) => {
  resetSandboxLedger();
  res.json({ ok: true, senders: listSandboxSenders() });
});

app.get("/api/universal/testnet-proof", async (_req, res) => {
  try {
    const [snapshot, last] = await Promise.all([
      testnetProofSnapshot(),
      Promise.resolve(getLastTestnetWitness()),
    ]);
    res.json({ ok: true, snapshot, lastBoundIntoReceipt: last ?? null });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "testnet proof failed" });
  }
});

app.post("/api/universal/sandbox-accounts", (req, res) => {
  try {
    const account = createSandboxAccount({
      displayName: String(req.body?.displayName || ""),
      preferredAsset: String(req.body?.preferredAsset || "USD").toUpperCase() as
        | "USD"
        | "BTC"
        | "CIRCLE_UNIT",
      preferredMethod: req.body?.preferredMethod,
      jurisdiction: req.body?.jurisdiction,
    });
    res.status(201).json({ ok: true, account });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "bad request" });
  }
});

app.post("/api/universal/sandbox-accounts/:id/verify", (req, res) => {
  try {
    const account = verifySandboxAccount(String(req.params.id), {
      level: String(req.body?.level || "sandbox_verified") as
        | "sandbox_verified"
        | "enhanced_verified",
      walletScreened:
        req.body?.walletScreened === undefined
          ? undefined
          : Boolean(req.body.walletScreened),
      sanctionsStatus: req.body?.sanctionsStatus,
    });
    res.json({ ok: true, account });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "verify failed" });
  }
});

app.get("/api/universal/route-cards", (_req, res) => {
  res.json({ ok: true, cards: listRouteCards() });
});

app.post("/api/universal/quote", (req, res) => {
  try {
    const result = createUniversalQuote({
      accountId: String(req.body?.accountId || ""),
      amount: String(req.body?.amount || ""),
      senderId: req.body?.senderId ? String(req.body.senderId) : undefined,
      sourceAsset: req.body?.sourceAsset ? String(req.body.sourceAsset) : undefined,
      sourceMethod: req.body?.sourceMethod ? String(req.body.sourceMethod) : undefined,
    });
    res.json({
      ok: true,
      quoteId: result.quote.quoteId,
      quote: result.quote,
      accountId: result.accountId,
      intent: {
        sourceAsset: result.intent.sourceAsset,
        targetAsset: result.intent.targetAsset,
        sourceMethod: result.intent.sourceMethod,
        targetMethod: result.intent.targetMethod,
        recipientId: result.intent.recipientId,
      },
    });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "quote failed" });
  }
});

app.post("/api/universal/route", (req, res) => {
  try {
    const { route, binding } = createUniversalRoute({
      quoteId: String(req.body?.quoteId || ""),
    });
    res.json({
      ok: true,
      routeId: route.routeId,
      quoteId: route.quote.quoteId,
      sourceAdapter: route.sourceAdapter,
      conversionAdapter: route.conversionAdapter,
      targetAdapter: route.targetAdapter,
      routeCommitment: route.routeCommitment,
      compliance: route.compliance,
      estimatedSettlementTimeMs: route.estimatedSettlementTimeMs,
      mock: route.mock,
      quote: route.quote,
      binding,
      note: route.note,
    });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "route failed" });
  }
});

async function handleUniversalSettle(req: Request, res: Response) {
  try {
    const payment = await settleUniversal({
      quoteId: String(req.body?.quoteId || ""),
      routeId: String(req.body?.routeId || ""),
      routeCommitment: String(req.body?.routeCommitment || ""),
      tamperRouteId: req.body?.tamperRouteId
        ? String(req.body.tamperRouteId)
        : undefined,
    });
    res.json({
      ok: true,
      payment,
      quoteId: payment.quoteId,
      routeId: payment.routeId,
      sourceAdapter: payment.sourceAdapter,
      conversionAdapter: payment.conversionAdapter,
      targetAdapter: payment.targetAdapter,
      proofMode: payment.proofMode,
      attestationGrade: payment.attestationGrade,
      circuit: payment.circuit,
      snarkDigest: payment.snarkDigest,
      bindingDigest: payment.bindingDigest,
      proveMs: payment.proveMs,
      intentCommitment: payment.intentCommitment,
      receiptId: payment.receiptId,
      lifecycleState: payment.lifecycleState,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "settle failed";
    const status = msg.includes("commitment mismatch")
      ? 409
      : msg.includes("Settle blocked")
        ? 403
        : 400;
    res.status(status).json({ error: msg });
  }
}

app.post("/api/universal/sandbox-settle", handleUniversalSettle);
app.post("/api/universal/settle", handleUniversalSettle);

app.get("/api/universal/payments/:id", (req, res) => {
  const payment = getUniversalPayment(req.params.id);
  if (!payment) return res.status(404).json({ error: "not found" });
  res.json({ ok: true, payment });
});

app.get("/api/universal/receipt/:id", (req, res) => {
  const payment = getUniversalPayment(req.params.id);
  if (!payment) return res.status(404).json({ error: "not found" });
  res.json({
    ok: true,
    receiptId: payment.receiptId,
    quoteId: payment.quoteId,
    routeId: payment.routeId,
    lifecycleState: payment.lifecycleState,
    proofMode: payment.proofMode,
    attestationGrade: payment.attestationGrade,
    circuit: payment.circuit,
    snarkDigest: payment.snarkDigest,
    bindingDigest: payment.bindingDigest,
    intentCommitment: payment.intentCommitment,
    sourceAdapter: payment.sourceAdapter,
    conversionAdapter: payment.conversionAdapter,
    targetAdapter: payment.targetAdapter,
    riskDecision: payment.riskDecision,
    reconciliationGaps: payment.reconciliationGaps,
    timeline: payment.timeline,
    senderId: payment.senderId,
    testnetWitness: payment.testnetWitness,
  });
});

app.post("/api/universal/refund", async (req, res) => {
  try {
    const payment = await refundUniversal(
      String(req.body?.paymentId || req.body?.id || "")
    );
    res.json({ ok: true, payment });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "refund failed" });
  }
});

app.post("/api/universal/reconcile", async (req, res) => {
  try {
    const payment = await reconcileUniversalPayment(
      String(req.body?.paymentId || req.body?.id || "")
    );
    res.json({
      ok: true,
      payment,
      gaps: payment.reconciliationGaps,
      pendingReconciliation: payment.reconciliationGaps.length,
    });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "reconcile failed" });
  }
});

app.get("/api/ops/universal", async (_req, res) => {
  res.json(await universalOpsDashboard());
});

app.get("/api/judge/command-center", async (_req, res) => {
  const ops = await universalOpsDashboard();
  const midnight = await probeMidnightFoundation().catch(() => null);
  const latest = ops.latestReceipt;
  res.json({
    ok: true,
    proofServer: ops.proof,
    compact: {
      circuits: [
        "prove_authorized_transaction",
        "prove_credit_update",
        "prove_balance",
        "prove_spend_update",
      ],
      note: "Compact circuits loaded via midnight foundation / compact-runtime fallback",
      artifactsOk: midnight?.compactArtifacts?.ok ?? false,
      artifactsDetail: midnight?.compactArtifacts?.detail,
    },
    activeRoute: latest,
    technicalReceipt: latest
      ? {
          quoteId: latest.quoteId,
          routeId: latest.routeId,
          routeCommitment: latest.routeCommitment,
          receiptId: latest.receiptId,
          lifecycleState: latest.lifecycleState,
          sourceAdapter: latest.sourceAdapter,
          conversionAdapter: latest.conversionAdapter,
          targetAdapter: latest.targetAdapter,
          proofMode: latest.proofMode,
          attestationGrade: latest.attestationGrade,
          snarkDigest: latest.snarkDigest,
          proveMs: latest.proveMs,
        }
      : null,
    midnight: midnight
      ? {
          ready: Boolean(midnight.proofServer?.ok || midnight.compactArtifacts?.ok),
          networkId: midnight.networkId,
          proofServer: midnight.proofServer,
          compactArtifacts: midnight.compactArtifacts,
        }
      : { ready: false },
    settle: ops.settle,
    metrics: {
      quotes: ops.metrics.quotes,
      routes: ops.metrics.routes,
      settled: ops.metrics.settled,
      failed: ops.metrics.failed,
      refunds: ops.metrics.refunds,
      tamperRejects: ops.metrics.tamperRejects,
      riskHolds: ops.metrics.riskHolds,
      sanctionsBlocks: ops.metrics.sanctionsBlocks,
      pendingReconciliation: ops.metrics.pendingReconciliation,
    },
    pilotHealth: ops.pilotHealth,
    stripeTest: ops.stripeTest,
    sandboxProvider: ops.sandboxProvider,
  });
});

app.get("/api/asset", (_req, res) => {
  res.json({
    id: "CIRCLE_UNIT",
    symbol: "CIRCLE",
    name: "CircleProof product unit",
    networkFeeAsset: "tDUST",
    oneLiner:
      "Class 0 CIRCLE product units on the device vault; public side is Compact balance commitments. Not INR ACH / UPI / USDC — Midnight gold path is Compact + proof-server SNARKs; Preprod tDUST only for optional on-chain broadcast fees.",
  });
});

/** Compliance ops dashboard (sanctions age, SAR posture, KYC audit, disputes) */
app.get("/api/compliance/ops", (_req, res) => {
  const issuance = store.issuanceRecords ?? [];
  const latest = issuance[issuance.length - 1];
  const sanctionsAgeMs = latest ? Date.now() - latest.sanctionsCheckedAt : null;
  res.json({
    ok: true,
    asset: "CIRCLE_UNIT",
    sanctions: {
      rescreenMs: SANCTIONS_RESCREEN_MS,
      lastCheckedAt: latest?.sanctionsCheckedAt ?? null,
      ageMs: sanctionsAgeMs,
      stale: sanctionsAgeMs != null ? sanctionsAgeMs > SANCTIONS_RESCREEN_MS : true,
    },
    kycAudit: (store.kycAudit ?? []).slice(0, 20),
    disputesOpen: (store.disputes ?? []).filter(
      (d) => d.status === "opened" || d.status === "merchant_review"
    ).length,
    retention: compliance.retention(),
    kycProvider: compliance.kycProviderId,
    paymentLifecycle: reconciliationSummary(store),
    settleMetrics: settleMetricsView(),
    gaps: [
      "SAR/STR: low-value capped wallet strategy — escalate via selective disclosure under order",
      "Recovery DPA: threshold cloud backup is optional; passphrase kit is device-held",
      "KYC issuer is sandbox — wire DigiLocker/Onfido-class provider before real money",
    ],
  });
});

app.get("/api/users/:id/disputes", (req, res) => {
  res.json({ disputes: listDisputes(store, req.params.id) });
});

app.post("/api/users/:id/disputes", (req, res) => {
  try {
    const rec = openDispute(store, {
      userId: req.params.id,
      paymentId: String(req.body?.paymentId ?? ""),
      amount: Number(req.body?.amount ?? 0),
      reason: String(req.body?.reason ?? "mistaken_recipient"),
    });
    res.json({ ok: true, dispute: rec });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Dispute failed" });
  }
});

app.post("/api/disputes/:id/advance", (req, res) => {
  try {
    const status = String(req.body?.status ?? "merchant_review") as DisputeStatus;
    const rec = advanceDispute(store, req.params.id, status);
    res.json({ ok: true, dispute: rec });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Advance failed" });
  }
});

/** Multi-party split plan (client still settles; server records opaque note commitments) */
app.post("/api/split/plan", (req, res) => {
  const legs = Array.isArray(req.body?.legs) ? req.body.legs : [];
  if (legs.length < 2) {
    return res.status(400).json({ error: "At least two split legs required" });
  }
  const normalized = legs.map(
    (l: { recipientLabel?: string; amount?: number }, i: number) => ({
      recipientLabel: String(l?.recipientLabel || `party-${i + 1}`),
      amount: Number(l?.amount),
    })
  );
  if (normalized.some((l: { amount: number }) => !Number.isFinite(l.amount) || l.amount <= 0)) {
    return res.status(400).json({ error: "Each leg needs a positive amount" });
  }
  const total = normalized.reduce((s: number, l: { amount: number }) => s + l.amount, 0);
  const noteCommitments = normalized.map(
    (l: { recipientLabel: string; amount: number }, i: number) =>
      `nc_split_${i}_${l.recipientLabel.slice(0, 8)}_${l.amount}`
  );
  res.json({ ok: true, total, legs: normalized, noteCommitments });
});

app.get("/api/health", async (_req, res) => {
  const midnight = await probeMidnightFoundation();
  const proof = await resolveProofMode();
  const compact = await readCompactLedger();
  const onchain = await deployStatus();
  const { probeMerchantHsm } = await import("./services/merchantHsm.js");
  const merchantHsm = await probeMerchantHsm();
  res.json({
    ok: true,
    service: "circled",
    version: "5.0.0",
    class0: "device-only",
    nyxproof: true,
    zkProve: "circuit /prove when proof-server healthy",
    midnight,
    proofMode: proof,
    compactLedger: compact,
    onchain,
    merchantHsm,
    settleMetrics: settleMetricsView(),
    paymentLifecycle: reconciliationSummary(store),
    compliance: {
      services: complianceDocument().serviceInventory.length,
      gapsOpen: complianceDocument().gapsToDisclose.filter((g) => g.status === "open").length,
    },
  });
});

/** Settle observability (privacy-safe aggregates) */
app.get("/api/ops/metrics", (_req, res) => {
  res.json({
    ok: true,
    settle: settleMetricsView(),
    reconciliation: reconciliationSummary(store),
  });
});

app.get("/api/users/:id/payments", (req, res) => {
  const user = findUser(req.params.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  const rows = listPaymentLifecycleForUser(store, user.id).map(publicReceiptView);
  res.json({ ok: true, payments: rows });
});

app.get("/api/payments/:paymentId", (req, res) => {
  const rec = getPaymentLifecycle(store, req.params.paymentId);
  if (!rec) return res.status(404).json({ error: "Payment not found" });
  res.json({ ok: true, ...publicReceiptView(rec) });
});

app.post("/api/payments/:paymentId/reconcile", (req, res) => {
  const out = reconcilePayment(store, {
    paymentId: req.params.paymentId,
    proofEventId: req.body?.proofEventId ? String(req.body.proofEventId) : undefined,
    railSettlementId: req.body?.railSettlementId
      ? String(req.body.railSettlementId)
      : undefined,
    deviceApplied: Boolean(req.body?.deviceApplied),
    recipientNotified: Boolean(req.body?.recipientNotified),
  });
  res.status(out.ok ? 200 : 409).json(out);
});

app.get("/api/rails/:railId/status/:refId", async (req, res) => {
  const adapter = resolveRailAdapter(req.params.railId) as {
    status?: (id: string) => Promise<unknown>;
  };
  if (!adapter.status) {
    return res.status(404).json({ error: "Rail does not expose status()" });
  }
  res.json(await adapter.status(req.params.refId));
});

/** HMAC webhook ack for sandbox PSP (and future ExtendedRailAdapters) */
app.post("/api/rails/:railId/webhook", async (req, res) => {
  const adapter = resolveRailAdapter(req.params.railId) as {
    handleWebhook?: (payload: unknown) => Promise<unknown>;
    capabilities?: () => { canWebhook?: boolean; mock?: boolean };
  };
  if (!adapter.handleWebhook) {
    return res.status(404).json({ error: "Rail does not expose handleWebhook()" });
  }
  const rawBody = JSON.stringify(req.body ?? {});
  const signature = String(
    req.header("x-circle-signature") ||
      req.header("x-sandbox-psp-signature") ||
      req.header("x-stripe-test-signature") ||
      req.header("stripe-signature") ||
      ""
  );
  const out = await adapter.handleWebhook({
    ...(req.body ?? {}),
    rawBody,
    signature,
  });
  const ok = Boolean((out as { ok?: boolean })?.ok);
  res.status(ok ? 200 : 401).json(out);
});

app.get("/api/compliance/audit-export", (_req, res) => {
  res.json(compliance.auditReporting.exportOpsBundle());
});

app.get("/api/midnight", async (_req, res) => {
  const midnight = await probeMidnightFoundation();
  const proof = await resolveProofMode();
  const compact = await readCompactLedger();
  const onchain = await deployStatus();
  res.json({ ...midnight, proofMode: proof, compactLedger: compact, onchain });
});

app.get("/api/compact/ledger", async (_req, res) => {
  res.json(await readCompactLedger());
});

/** Device vault helper — openings stay Class 0; server only returns persistentCommit */
app.post("/api/compact/commit", async (req, res) => {
  try {
    const balance = req.body?.balance;
    const opening = String(req.body?.opening ?? "");
    if (balance === undefined || !/^[0-9a-fA-F]{64}$/.test(opening)) {
      return res.status(400).json({ error: "balance + 32-byte hex opening required" });
    }
    const { compactBalanceCommit, hexToOpening } = await import("./services/compactCommit.js");
    const commitment = compactBalanceCommit(BigInt(balance), hexToOpening(opening));
    res.json({ commitment, scheme: "persistentCommit<Field>" });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

app.get("/api/onchain", async (_req, res) => {
  res.json(await deployStatus());
});

app.get("/api/compliance", (_req, res) => {
  res.json({
    ...complianceDocument(),
    nyxproof: nyxproofDocument(),
      productionGrade: {
      class0:
        "Device vault — non-extractable AES-GCM wrap key (IndexedDB); secrets never leave device",
      serverHolds:
        "Commitments, nullifiers, KYC leaves, encrypted notes, sealed merchant secrets",
      auth: "ECDSA P-256 — server verifies with public key only",
      proofPath:
        "Compact-runtime execute + real proof-server /prove SNARKs (grade zk-proved); structural-only rejected under NYXPAY_REQUIRE_PROOFS",
      storeSchema: 4,
      storeEngine: "better-sqlite3",
      otpReplacement: "CircleProof prove_session_auth — no transmittable code",
      verifiedMerchantPayment: "a26z-Brand skill — POST /api/skills/verified-merchant-payment",
      railAgnosticTxAuth:
        "a26z-Brand intent auth — POST /api/skills/rail-agnostic-tx-auth/authorize",
      receivingPayment:
        "Phase 10 JIT receive — POST /api/skills/receiving-payment/receive (prove_credit_update)",
      strict: String(cfg.isStrict),
      requireProofs: String(cfg.requireProofs),
      secretEncryption: "MERCHANT_KEK AES-256-GCM (enc:v1:)",
      compactArithmetic: "HistoricMerkleTree + persistentCommit Field spend/credit",
      merchantHsm: process.env.NYXPAY_MERCHANT_SIGNING || "software",
      merchantAutoProve: String(
        process.env.NYXPAY_ALLOW_MERCHANT_AUTO_PROVE === "1" || !cfg.isStrict
      ),
      requireOnchain: String(cfg.requireOnchain),
    },
  });
});

// ——— CircleProof: OTP replacement (circledproof alias + legacy nyxproof) ———
app.get(["/api/nyxproof", "/api/circledproof"], (_req, res) => {
  res.json(nyxproofDocument());
});

// ——— verified-merchant-payment (a26z-Brand agent skill) ———
app.get("/api/skills/verified-merchant-payment", (_req, res) => {
  res.json(skillDocument());
});

app.get("/api/skills/verified-merchant-payment/registries", (_req, res) => {
  res.json({ registries: listBrandRegistries(store) });
});

app.post("/api/skills/verified-merchant-payment/challenge", (req, res) => {
  const { merchant_identifier, payment_address, agent_session_id } = req.body ?? {};
  if (!merchant_identifier || !payment_address) {
    return res.status(400).json({
      verified: false,
      reason: "missing_required_fields",
      detail: "merchant_identifier and payment_address required",
    });
  }
  const issued = issueMerchantChallenge(store, {
    merchant_identifier: String(merchant_identifier),
    payment_address: String(payment_address),
    agent_session_id: agent_session_id ? String(agent_session_id) : undefined,
  });
  if (!issued.ok) {
    return res.status(422).json({
      verified: false,
      reason: issued.reason,
      detail: issued.detail,
      private_information_exposed: false,
    });
  }
  res.json({
    proof_challenge_id: issued.challenge.id,
    platform_challenge: issued.challenge.platformChallenge,
    time_window: issued.challenge.timeWindow,
    expires_at: issued.challenge.expiresAt,
    brand_registry_root: issued.brand_registry_root,
    payment_address: issued.challenge.paymentAddress,
    note: "Challenge is public. Merchant proof must bind this challenge + payment_address.",
  });
});

app.post("/api/skills/verified-merchant-payment", (req, res) => {
  const result = verifyMerchantPayment(store, {
    merchant_identifier: String(req.body?.merchant_identifier ?? ""),
    payment_address: String(req.body?.payment_address ?? ""),
    network: String(req.body?.network ?? ""),
    amount: req.body?.amount != null ? Number(req.body.amount) : undefined,
    required_claims: Array.isArray(req.body?.required_claims)
      ? req.body.required_claims.map(String)
      : undefined,
    agent_session_id: req.body?.agent_session_id
      ? String(req.body.agent_session_id)
      : undefined,
    proof: req.body?.proof,
  });
  res.status(result.verified ? 200 : 422).json(result);
});

app.post("/api/skills/verified-merchant-payment/revoke", (req, res) => {
  const { merchant_identifier, reasonCode } = req.body ?? {};
  if (!merchant_identifier) {
    return res.status(400).json({ error: "merchant_identifier required" });
  }
  const out = revokeMerchant(store, String(merchant_identifier), String(reasonCode || "AUTHORIZATION_ENDED"));
  if (!out.ok) return res.status(404).json(out);
  res.json({ revoked: true, ...out });
});

// ——— rail-agnostic-tx-auth (intent commitment · settlement-rail independent) ———
app.get("/api/skills/rail-agnostic-tx-auth", (_req, res) => {
  res.json(txAuthSkillDocument(store));
});

app.get("/api/skills/rail-agnostic-tx-auth/registry/sync", (_req, res) => {
  res.json(syncRegistry(store));
});

app.get("/api/skills/rail-agnostic-tx-auth/metrics", (_req, res) => {
  res.json(metricsView(txAuthState(store).metrics));
});

app.post("/api/skills/rail-agnostic-tx-auth/intent/commit", (req, res) => {
  try {
    const intent = req.body?.intent ?? req.body;
    const out = commitIntent({
      merchant_identifier: String(intent.merchant_identifier ?? ""),
      order_reference: String(intent.order_reference ?? ""),
      amount: Number(intent.amount),
      currency: String(intent.currency ?? ""),
      settlement_rail: String(intent.settlement_rail ?? ""),
      settlement_destination: String(intent.settlement_destination ?? ""),
      nonce: String(intent.nonce ?? randomNonce(16)),
      timestamp: Number(intent.timestamp ?? Date.now()),
    });
    res.json(out);
  } catch (e) {
    res.status(400).json({
      authorized: false,
      reason: "malformed_commitment",
      detail: e instanceof Error ? e.message : String(e),
    });
  }
});

app.post("/api/skills/rail-agnostic-tx-auth/challenge", (req, res) => {
  try {
    const intent_commitment = String(req.body?.intent_commitment ?? "");
    const challenge = issueTxAuthChallenge(store, {
      intent_commitment,
      agent_session_id: req.body?.agent_session_id
        ? String(req.body.agent_session_id)
        : undefined,
    });
    res.json(challenge);
  } catch (e) {
    res.status(400).json({
      authorized: false,
      reason: "malformed_commitment",
      detail: e instanceof Error ? e.message : String(e),
    });
  }
});

app.post("/api/skills/rail-agnostic-tx-auth/merchant/authorize", async (req, res) => {
  const intent = req.body?.intent;
  const intent_commitment = String(req.body?.intent_commitment ?? "");
  if (!intent || !intent_commitment) {
    return res.status(400).json({
      authorized: false,
      reason: "missing_required_fields",
      detail: "intent and intent_commitment required",
    });
  }
  const out = await authorizeIntent(store, {
    intent,
    intent_commitment,
    intent_signature: req.body?.intent_signature
      ? String(req.body.intent_signature)
      : undefined,
  });
  if (!out.ok) return res.status(422).json(out);
  res.json(out.authorization);
});

app.post("/api/skills/rail-agnostic-tx-auth/prove", async (req, res) => {
  const out = await generateAuthorizedTxProof(store, {
    merchant_identifier: String(req.body?.merchant_identifier ?? ""),
    intent_commitment: String(req.body?.intent_commitment ?? ""),
    challenge_id: String(req.body?.challenge_id ?? ""),
    authorization: req.body?.authorization,
  });
  if (!out.ok) return res.status(422).json(out);
  res.json(out.proof);
});

app.post("/api/skills/rail-agnostic-tx-auth/verify", (req, res) => {
  const result = verifyAuthorizedTransaction(store, {
    intent: req.body?.intent,
    intent_commitment: String(req.body?.intent_commitment ?? ""),
    challenge_id: String(req.body?.challenge_id ?? ""),
    proof: req.body?.proof,
  });
  res.status(result.authorized ? 200 : 422).json(result);
});

app.post("/api/skills/rail-agnostic-tx-auth/authorize", async (req, res) => {
  const body = req.body ?? {};
  if (
    !body.merchant_identifier ||
    !body.order_reference ||
    body.amount == null ||
    !body.currency ||
    !body.settlement_rail ||
    !body.settlement_destination
  ) {
    return res.status(400).json({
      authorized: false,
      reason: "missing_required_fields",
      detail:
        "merchant_identifier, order_reference, amount, currency, settlement_rail, settlement_destination required",
      private_information_exposed: false,
    });
  }
  const result = await runAuthorizeWorkflow(store, {
    merchant_identifier: String(body.merchant_identifier),
    order_reference: String(body.order_reference),
    amount: Number(body.amount),
    currency: String(body.currency),
    settlement_rail: String(body.settlement_rail),
    settlement_destination: String(body.settlement_destination),
    agent_session_id: body.agent_session_id ? String(body.agent_session_id) : undefined,
    settle: Boolean(body.settle),
  });
  res.status(result.verification.authorized ? 200 : 422).json(result);
});

app.post("/api/skills/rail-agnostic-tx-auth/revoke", (req, res) => {
  const { merchant_identifier, reason } = req.body ?? {};
  if (!merchant_identifier) {
    return res.status(400).json({ error: "merchant_identifier required" });
  }
  const out = revokeTxAuthMerchant(
    store,
    String(merchant_identifier),
    String(reason || "AUTHORIZATION_ENDED")
  );
  if (!out.ok) return res.status(404).json(out);
  res.json({ revoked: true, ...out });
});

app.get("/api/skills/rail-agnostic-tx-auth/rails", (_req, res) => {
  res.json({
    principle: "Adapters only — destination opaque to circuit; new rail = new adapter file",
    rails: listRailAdapters(),
  });
});

app.post("/api/skills/rail-agnostic-tx-auth/settle", async (req, res) => {
  const { intent, intent_commitment, verification, proof_challenge_id } = req.body ?? {};
  if (!intent || !intent_commitment || !verification?.authorized || !proof_challenge_id) {
    return res.status(400).json({
      ok: false,
      note: "Verified authorization artifact required before settlement",
    });
  }
  const receipt = await settleVerifiedTransaction({
    intent,
    intent_commitment: String(intent_commitment),
    verification,
    proof_challenge_id: String(proof_challenge_id),
  });
  res.status(receipt.ok ? 200 : 422).json(receipt);
});

// ——— receiving-payment (Phase 10 · JIT dest · order_ref · credit circuit) ———
app.get("/api/skills/receiving-payment", (_req, res) => {
  res.json(receivePaySkillDocument(store));
});

app.post("/api/skills/receiving-payment/mint-destination", (req, res) => {
  const body = req.body ?? {};
  const out = mintDestination(store, {
    intent: {
      merchant_identifier: String(body.merchant_identifier ?? ""),
      order_reference: String(body.order_reference ?? ""),
      amount: Number(body.amount),
      currency: String(body.currency ?? ""),
      settlement_rail: String(body.settlement_rail ?? ""),
      nonce: body.nonce ? String(body.nonce) : undefined,
      timestamp: body.timestamp != null ? Number(body.timestamp) : undefined,
    },
    intent_commitment: body.intent_commitment ? String(body.intent_commitment) : undefined,
  });
  if (!out.ok) return res.status(422).json(out);
  res.json({
    destination: out.destination,
    intent: out.intent,
    intent_commitment: out.intent_commitment,
    note: "Destination is single-use and burned at mint — never reuse across transactions",
  });
});

app.post("/api/skills/receiving-payment/observe", (req, res) => {
  const out = observeInbound(store, {
    order_reference: String(req.body?.order_reference ?? ""),
    payment_ref: String(req.body?.payment_ref ?? ""),
    amount: Number(req.body?.amount),
    currency: req.body?.currency ? String(req.body.currency) : undefined,
    settlement_destination: req.body?.settlement_destination
      ? String(req.body.settlement_destination)
      : undefined,
  });
  res.status(out.ok ? 200 : 422).json(out);
});

app.post("/api/skills/receiving-payment/reconcile", (req, res) => {
  const out = reconcileByOrderRef(store, String(req.body?.order_reference ?? ""));
  res.status(out.ok ? 200 : 422).json(out);
});

app.get("/api/skills/receiving-payment/unmatched", (_req, res) => {
  res.json({ unmatched: listUnmatched(store) });
});

app.post("/api/skills/receiving-payment/buyer-status", (req, res) => {
  const intent_commitment = String(req.body?.intent_commitment ?? "");
  if (!intent_commitment) {
    return res.status(400).json({ error: "intent_commitment required" });
  }
  res.json(
    resolveBuyerPaymentState(store, {
      intent_commitment,
      payment_sent: req.body?.payment_sent !== false,
    })
  );
});

app.post("/api/skills/receiving-payment/confirm", async (req, res) => {
  const out = await issueSettlementConfirmation(store, {
    order_reference: String(req.body?.order_reference ?? ""),
  });
  res.status(out.ok ? 200 : 422).json(out);
});

app.post("/api/skills/receiving-payment/confirm/verify", (req, res) => {
  const out = verifySettlementConfirmation(store, req.body?.confirmation);
  res.status(out.ok ? 200 : 422).json(out);
});

app.post("/api/skills/receiving-payment/credit", async (req, res) => {
  const out = await creditPrivateBalance(store, {
    order_reference: String(req.body?.order_reference ?? ""),
    merchant_account_id: req.body?.merchant_account_id
      ? String(req.body.merchant_account_id)
      : undefined,
    old_balance_commitment: String(req.body?.old_balance_commitment ?? ""),
    new_balance_commitment: String(req.body?.new_balance_commitment ?? ""),
  });
  res.status(out.ok ? 200 : 422).json(out);
});

app.post("/api/skills/receiving-payment/receive", async (req, res) => {
  const body = req.body ?? {};
  if (
    !body.merchant_identifier ||
    !body.order_reference ||
    body.amount == null ||
    !body.currency ||
    !body.settlement_rail
  ) {
    return res.status(400).json({
      ok: false,
      reason: "missing_required_fields",
      detail:
        "merchant_identifier, order_reference, amount, currency, settlement_rail required",
    });
  }
  const result = await runReceiveWorkflow(store, {
    merchant_identifier: String(body.merchant_identifier),
    order_reference: String(body.order_reference),
    amount: Number(body.amount),
    currency: String(body.currency),
    settlement_rail: String(body.settlement_rail),
    simulate_inbound: body.simulate_inbound !== false,
    merchant_account_id: body.merchant_account_id
      ? String(body.merchant_account_id)
      : undefined,
    old_balance_commitment: body.old_balance_commitment
      ? String(body.old_balance_commitment)
      : undefined,
    new_balance_commitment: body.new_balance_commitment
      ? String(body.new_balance_commitment)
      : undefined,
    run_credit: body.run_credit !== false,
  });
  res.status(result.ok ? 200 : 422).json(result);
});

/** Merchant webhook stub — fires on order reconcile / credit (demo) */
app.post("/api/skills/receiving-payment/webhook", (req, res) => {
  const body = req.body ?? {};
  const event = {
    id: `wh_${Date.now().toString(36)}`,
    type: String(body.type || "payment.received"),
    order_reference: body.order_reference ? String(body.order_reference) : null,
    destination: body.destination ? String(body.destination) : null,
    receivedAt: Date.now(),
    note: "Stub webhook — merchant systems would verify HMAC + credit inventory here",
  };
  console.info("[merchant-webhook]", event);
  res.json({ ok: true, delivered: true, event });
});

// ——— Circle Credit v1 (same-asset overcollateralized · pool-funded) ———
app.get("/api/skills/circled-credit", (_req, res) => {
  res.json(creditSkillDocument());
});

app.get("/api/skills/circled-credit/status", (_req, res) => {
  const status = getCreditStatus(store);
  // Persist one-time pilot pool seed from creditState()
  saveStore(store);
  res.json(status);
});

app.get("/api/skills/circled-credit/compliance", (_req, res) => {
  res.json(creditComplianceDocument());
});

app.get("/api/skills/circled-credit/disclosure", (req, res) => {
  const loanAmount = Number(req.query.loanAmount ?? req.query.amount ?? 0);
  const collateralAmount = Number(
    req.query.collateralAmount ?? Math.ceil((loanAmount * 3) / 2)
  );
  const installments =
    req.query.installments != null ? Number(req.query.installments) : undefined;
  if (String(req.query.deals ?? "") === "1" || String(req.query.deals ?? "") === "true") {
    return res.json(previewBorrowDeals({ loanAmount, collateralAmount }));
  }
  res.json(previewBorrowDisclosure({ loanAmount, collateralAmount, installments }));
});

app.post("/api/skills/circled-credit/identity", (req, res) => {
  const user = findUser(String(req.body?.userId ?? ""));
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json(issueCreditIdentity(user));
});

app.get("/api/skills/circled-credit/loans/:userId", (req, res) => {
  res.json({ loans: listBorrowerLoans(store, req.params.userId) });
});

app.post("/api/skills/circled-credit/pool/deposit", async (req, res) => {
  const user = findUser(String(req.body?.userId ?? ""));
  if (!user) return res.status(404).json({ error: "User not found" });
  const out = await depositToPool(store, user, {
    amount: Number(req.body?.amount),
    oldBalanceCommitment: String(req.body?.oldBalanceCommitment ?? ""),
    newBalanceCommitment: String(req.body?.newBalanceCommitment ?? ""),
    balanceWitness: req.body?.balanceWitness,
  });
  res.status(out.ok ? 200 : 422).json(out);
});

app.post("/api/skills/circled-credit/borrow", async (req, res) => {
  const user = findUser(String(req.body?.userId ?? ""));
  if (!user) return res.status(404).json({ error: "User not found" });
  const out = await borrowFromPool(store, user, {
    loanAmount: Number(req.body?.loanAmount),
    collateralAmount: Number(req.body?.collateralAmount),
    installments: req.body?.installments != null ? Number(req.body.installments) : undefined,
    oldBalanceCommitment: String(req.body?.oldBalanceCommitment ?? ""),
    newBalanceCommitment: String(req.body?.newBalanceCommitment ?? ""),
    collateralCommitment: String(req.body?.collateralCommitment ?? ""),
    balanceWitness: req.body?.balanceWitness,
    disbursedBalanceCommitment: String(req.body?.disbursedBalanceCommitment ?? ""),
    disbursementWitness: req.body?.disbursementWitness,
  });
  res.status(out.ok ? 200 : 422).json(out);
});

app.post("/api/skills/circled-credit/repay", async (req, res) => {
  const user = findUser(String(req.body?.userId ?? ""));
  if (!user) return res.status(404).json({ error: "User not found" });
  const out = await repayLoan(store, user, {
    loanId: String(req.body?.loanId ?? ""),
    oldBalanceCommitment: String(req.body?.oldBalanceCommitment ?? ""),
    newBalanceCommitment: String(req.body?.newBalanceCommitment ?? ""),
    balanceWitness: req.body?.balanceWitness,
  });
  res.status(out.ok ? 200 : 422).json(out);
});

app.post("/api/skills/circled-credit/standing", async (req, res) => {
  const user = findUser(String(req.body?.userId ?? ""));
  if (!user) return res.status(404).json({ error: "User not found" });
  const out = await proveStanding(store, user, {
    onTimeThreshold: Number(req.body?.onTimeThreshold ?? 0),
    maxDefaultsAllowed: Number(req.body?.maxDefaultsAllowed ?? 0),
  });
  res.status(out.ok ? 200 : 422).json(out);
});

app.post("/api/skills/circled-credit/liquidate", (req, res) => {
  const out = liquidateIfDue(store, String(req.body?.loanId ?? ""));
  res.status(out.ok ? 200 : 422).json(out);
});

/** Compelled bureau path — only when CREDIT_BUREAU_MODE=selective_disclosure */
app.post("/api/skills/circled-credit/bureau-furnish", (req, res) => {
  const user = findUser(String(req.body?.userId ?? ""));
  if (!user) return res.status(404).json({ error: "User not found" });
  try {
    const out = furnishCreditBureauReport(store, user, String(req.body?.viewKey ?? ""), {
      creditIdentity: String(req.body?.creditIdentity ?? ""),
      onTimeCount: Number(req.body?.onTimeCount ?? 0),
      defaults: Number(req.body?.defaults ?? 0),
      loanSummaries: req.body?.loanSummaries,
    });
    res.status(out.ok ? 200 : 422).json(out);
  } catch (e) {
    res.status(422).json({ ok: false, reason: e instanceof Error ? e.message : String(e) });
  }
});

// ——— Brand catalog (1000 popular brands · registered vs unverified) ———
app.get("/api/brands/stats", (_req, res) => {
  res.json(catalogStats());
});

app.get("/api/brands/lookup", (req, res) => {
  const q = String(req.query.q ?? req.query.recipient ?? "").trim();
  if (!q) return res.status(400).json({ error: "q or recipient required" });
  res.json(classifyRecipient(store, q));
});

app.post("/api/brands/lookup", (req, res) => {
  const q = String(req.body?.recipient ?? req.body?.q ?? "").trim();
  if (!q) return res.status(400).json({ error: "recipient required" });
  res.json(classifyRecipient(store, q));
});

/**
 * Recipient verification for unknown / non-contact payees.
 *
 * Names are NOT unique — many people share one. So this resolves a spoken name
 * to a set of distinct identities (unique handle + jurisdiction + opaque account
 * id) and only reports "verified" when exactly one KYC-cleared identity matches.
 * Multiple matches return "ambiguous" so the UI can force an explicit pick.
 */
app.post("/api/recipients/verify", (req, res) => {
  const q = String(req.body?.recipient ?? req.body?.q ?? "").trim();
  if (!q) return res.status(400).json({ error: "recipient required" });
  // Optional: caller already resolved to a specific identity handle/id.
  const selectedId = req.body?.identityId ? String(req.body.identityId) : "";

  // 1) Registered brand / merchant (single canonical identity).
  const brand = classifyRecipient(store, q);
  if (brand.status === "verified" && brand.brand) {
    return res.json({
      ok: true,
      recipient: q,
      status: "verified",
      basis: "brand_registry",
      label: `${brand.brand.name} · verified merchant`,
      detail: `Registered merchant · ${brand.brand.domain}`,
      matches: [
        {
          id: brand.brand.id,
          displayName: brand.brand.name,
          handle: brand.brand.domain,
          asset: "—",
          jurisdiction: "merchant",
          kycStatus: "brand_registered",
          sanctionsStatus: "clear",
          maskedId: brand.merchant_identifier
            ? `${String(brand.merchant_identifier).slice(0, 10)}…`
            : brand.brand.domain,
          verified: true,
        },
      ],
    });
  }

  // 2) All sandbox identities matching this name/handle (there may be several).
  const norm = q.toLowerCase();
  const all = listSandboxAccounts().filter(
    (a) =>
      a.displayName.toLowerCase() === norm ||
      a.displayName.toLowerCase().split(" ")[0] === norm ||
      a.handle.toLowerCase() === norm
  );
  const toMatch = (a: (typeof all)[number]) => ({
    id: a.id,
    displayName: a.displayName,
    handle: a.handle,
    asset: a.preferredAsset,
    jurisdiction: a.jurisdiction,
    kycStatus: a.kycStatus,
    sanctionsStatus: a.sanctionsStatus,
    maskedId: `${a.opaqueDestinationId.slice(0, 10)}…`,
    verified: a.kycStatus !== "unverified" && a.sanctionsStatus === "clear",
  });

  // If the caller pre-selected an identity, evaluate just that one.
  const scoped = selectedId ? all.filter((a) => a.id === selectedId) : all;

  if (scoped.length === 0) {
    return res.json({
      ok: true,
      recipient: q,
      status: "unverified",
      basis: "none",
      label: "Not in any verified registry",
      detail: "No brand-registry match and no cleared KYC record for this payee.",
      matches: [],
    });
  }

  if (scoped.length > 1) {
    return res.json({
      ok: true,
      recipient: q,
      status: "ambiguous",
      basis: "kyc_ambiguous",
      label: `${scoped.length} people match “${q}”`,
      detail: "More than one identity shares this name — pick the exact recipient.",
      matches: scoped.map(toMatch),
    });
  }

  const only = toMatch(scoped[0]);
  return res.json({
    ok: true,
    recipient: q,
    status: only.verified ? "verified" : "unverified",
    basis: only.verified
      ? only.kycStatus === "enhanced_verified"
        ? "kyc_enhanced"
        : "kyc_sandbox"
      : "kyc_pending",
    label: only.verified
      ? `${only.displayName} · @${only.handle}`
      : `${only.displayName} · KYC pending`,
    detail: only.verified
      ? `KYC ${only.kycStatus} · ${only.jurisdiction} · ${only.maskedId}`
      : "Identity exists but KYC is not cleared yet.",
    kycStatus: only.kycStatus,
    matches: [only],
  });
});

app.get("/api/brands", (req, res) => {
  const registered = req.query.registered;
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const offset = Number(req.query.offset) || 0;
  let brands = loadBrandsCatalog().brands;
  if (registered === "true") brands = brands.filter((b) => b.registered);
  if (registered === "false") brands = brands.filter((b) => !b.registered);
  res.json({
    ...catalogStats(),
    offset,
    limit,
    brands: brands.slice(offset, offset + limit).map((b) => ({
      id: b.id,
      name: b.name,
      domain: b.domain,
      category: b.category,
      registered: b.registered,
      logoUrl: `https://logo.clearbit.com/${b.domain}`,
    })),
  });
});

app.post(["/api/nyxproof/challenge", "/api/circledproof/challenge"], (req, res) => {
  try {
    const { relyingPartyId, unlinkable, expectedUserId } = req.body ?? {};
    if (!relyingPartyId) {
      return res.status(400).json({ error: "relyingPartyId required" });
    }
    const ch = issueChallenge(store, {
      relyingPartyId: String(relyingPartyId),
      unlinkable: Boolean(unlinkable),
      expectedUserId: expectedUserId ? String(expectedUserId) : undefined,
    });
    // Challenge is public — safe to return in full
    res.json({
      ...ch,
      note: "Challenge is not a secret. Device proves possession locally; no OTP is sent.",
    });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "challenge failed" });
  }
});

app.post(["/api/nyxproof/verify", "/api/circledproof/verify"], (req, res) => {
  try {
    const { nonce, challenge, relyingPartyId, timeWindow, sessionProof, credentialCommitment } =
      req.body ?? {};
    if (!nonce || !challenge || !relyingPartyId || !timeWindow || !sessionProof) {
      return res.status(400).json({
        error: "nonce, challenge, relyingPartyId, timeWindow, sessionProof required",
      });
    }
    const result = verifyAndBurn(store, {
      nonce: String(nonce),
      challenge: String(challenge),
      relyingPartyId: String(relyingPartyId),
      timeWindow: String(timeWindow),
      sessionProof,
      credentialCommitment: credentialCommitment
        ? String(credentialCommitment)
        : undefined,
    });
    if (!result.ok) {
      return res.status(422).json(result);
    }
    res.json({
      ...result,
      message: result.unlinkable
        ? "Valid non-revoked credential holder authenticated — no stable user handle logged"
        : "Session authenticated; challenge burned",
    });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "verify failed" });
  }
});

app.get("/api/compliance/audit-report", (req, res) => {
  const from = req.query.from ? Number(req.query.from) : undefined;
  const to = req.query.to ? Number(req.query.to) : undefined;
  res.json(compliance.auditReporting.generatePublicReport({ from, to }));
});

app.get("/api/compliance/relay", (_req, res) => {
  res.json(compliance.settlementRelay.publicStats());
});

app.get("/api/compliance/revocations", (_req, res) => {
  res.json(compliance.revocation.publicStats());
});

app.get("/api/compliance/recovery-processor", (_req, res) => {
  res.json(compliance.recoveryCoordinator.processorDisclosure());
});

app.post("/api/compliance/sanctions/rescreen", (req, res) => {
  try {
    res.json(compliance.sanctionsRescreen.rescreen(req.body ?? {}));
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "rescreen failed" });
  }
});

app.post("/api/compliance/enrollment/begin", (req, res) => {
  try {
    const { ephemeralPubkey } = req.body ?? {};
    if (!ephemeralPubkey) return res.status(400).json({ error: "ephemeralPubkey required" });
    res.json(compliance.enrollmentRelay.beginHandshake(String(ephemeralPubkey)));
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "begin failed" });
  }
});

app.post("/api/compliance/enrollment/complete", (req, res) => {
  try {
    const { sessionToken, ephemeralPubkeyB } = req.body ?? {};
    res.json(
      compliance.enrollmentRelay.completeHandshake(String(sessionToken), String(ephemeralPubkeyB))
    );
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "complete failed" });
  }
});

app.post("/api/compliance/erasure-request", (req, res) => {
  const { issuanceRef } = req.body ?? {};
  const rec = store.issuanceRecords?.find((r) => r.issuanceRef === issuanceRef);
  if (!rec) {
    return res.status(404).json({
      error: "Issuance record not found",
      note: "Class 0 device data is deleted locally; Class 1 commitments are one-way.",
    });
  }
  res.json({
    issuanceRef: rec.issuanceRef,
    erasureGranted: false,
    reason: "AML recordkeeping typically prevails for Class 2 — disclosed per §5 / §7.",
    gapId: "erasure-vs-aml",
  });
});

app.get("/api/ledger", (_req, res) => {
  res.json(publicLedger(store));
});

app.get("/api/directory", (_req, res) => {
  res.json({
    users: store.users.map((u) => ({
      id: u.id,
      displayName: u.displayName,
      pubkeyHint: u.pubkey.slice(0, 12),
      publicKeyJwk: u.publicKeyJwk,
      credentialCommitment: u.credentialCommitment,
    })),
  });
});

app.post("/api/register", (req, res) => {
  try {
    const {
      displayName,
      documentReferenceHash,
      jurisdiction = "IN",
      deviceId,
      publicKeyJwk,
      balanceCommitment,
      policyCommitment,
      policyActive = ["T1", "T5"],
      vaultCiphertext,
    } = req.body ?? {};

    if (
      !displayName ||
      !documentReferenceHash ||
      !deviceId ||
      !publicKeyJwk ||
      !balanceCommitment ||
      !policyCommitment
    ) {
      return res.status(400).json({
        error:
          "displayName, documentReferenceHash, deviceId, publicKeyJwk, balanceCommitment, policyCommitment required",
      });
    }

    if (store.users.some((u) => u.displayName.toLowerCase() === String(displayName).toLowerCase())) {
      return res.status(409).json({ error: "Display name already registered" });
    }

    const issued = compliance.kycIssuance.issue({
      documentReferenceHash: String(documentReferenceHash),
      jurisdiction: String(jurisdiction),
    });
    if (!issued.record.pass) {
      return res.status(403).json({ error: "Government KYC verification failed" });
    }

    const pubkey = pubkeyThumbprint(publicKeyJwk as JsonWebKey);

    const kyc = issueKyc(store, {
      identityDocumentHash: String(documentReferenceHash),
      jurisdiction: String(jurisdiction),
      pubkey,
    });
    compliance.kycRegistry.publishCommitment(kyc);
    compliance.kycIssuance.attachCommitment(issued.record.issuanceRef, kyc.leaf);

    const user = createPublicAccount(store, {
      displayName: String(displayName),
      deviceId: String(deviceId),
      kyc,
      publicKeyJwk: publicKeyJwk as JsonWebKey,
      balanceCommitment: String(balanceCommitment),
      policyCommitment: String(policyCommitment),
      policyActive: policyActive as string[],
    });

    let vault = null;
    if (vaultCiphertext) {
      vault = provisionCloudVaultMeta(store, user.id, String(vaultCiphertext));
    }

    const viewKey = compliance.selectiveDisclosure.issueViewKeyCommitment(user);
    saveStore(store);

    res.json({
      user: publicUser(user),
      kyc: {
        commitment: kyc.leaf,
        nullifier: kyc.nullifier,
        nullifierHint: `${kyc.nullifier.slice(0, 10)}…`,
        registryRoot: store.kycRoot,
        jurisdiction: issued.record.jurisdiction,
        sanctionsClear: issued.record.sanctionsClear,
        issuanceRef: issued.record.issuanceRef,
        dataClass: 2,
      },
      vault,
      selectiveDisclosure: {
        viewKeyCommitment: viewKey.viewKeyCommitment,
        viewKey: viewKey.viewKey,
        note: viewKey.note,
      },
      message: "Class 0 never received. Public commitments registered.",
      class0: true,
    });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "register failed" });
  }
});

app.get("/api/users/:id", (req, res) => {
  const user = findUser(req.params.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({
    user: publicUser(user),
    vault: getVaultMeta(store, user.id),
    kycRoot: store.kycRoot,
  });
});

app.put("/api/users/:id/policy", (req, res) => {
  const user = findUser(req.params.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  const { policyCommitment, active, signature, intentCommitment } = req.body ?? {};
  if (!policyCommitment || !Array.isArray(active)) {
    return res.status(400).json({
      error: "policyCommitment and active[] required (params stay on device)",
    });
  }
  if (signature && intentCommitment) {
    if (
      !verifyEcdsaSignature(user.publicKeyJwk, String(intentCommitment), String(signature))
    ) {
      return res.status(401).json({ error: "Invalid signature" });
    }
  }
  user.policyCommitment = String(policyCommitment);
  user.policyActive = active as PolicyTemplateId[];
  store.events.push({
    id: randomNonce(8),
    type: "policy_commit",
    newPolicyCommitment: user.policyCommitment,
    timestamp: Date.now(),
    delayedUntil: Date.now(),
    released: true,
    meta: { note: "policy commitment only — params Class 0 on device" },
  });
  saveStore(store);
  res.json({ user: publicUser(user) });
});

app.get("/api/users/:id/prove-context", (req, res) => {
  const user = findUser(req.params.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({
    kycRoot: store.kycRoot,
    balanceCommitment: user.balanceCommitment,
    policyCommitment: user.policyCommitment,
    spentNullifiers: store.spentNullifiers.slice(-50),
    revokedNullifiers: store.revokedNullifiers,
  });
});

app.post("/api/users/:id/confirm", async (req, res) => {
  return handleSettle(req, res, req.params.id);
});

app.post("/api/settle", async (req, res) => {
  const userId = String(req.body?.userId ?? "");
  if (!userId) return res.status(400).json({ error: "userId required" });
  return handleSettle(req, res, userId);
});

app.get("/api/users/:id/notes", (req, res) => {
  const user = findUser(req.params.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  const notes = store.notes
    .filter((n) => n.recipientPubkey === user.pubkey && !n.claimed)
    .map((n) => ({
      id: n.id,
      ephemeralPublicKeyJwk: n.ephemeralPublicKeyJwk,
      ciphertext: n.ciphertext,
      noteCommitment: n.noteCommitment,
      createdAt: n.createdAt,
    }));
  res.json({ notes });
});

app.post("/api/users/:id/notes/:noteId/claim", (req, res) => {
  const user = findUser(req.params.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  const { newBalanceCommitment } = req.body ?? {};
  if (!newBalanceCommitment) {
    return res.status(400).json({ error: "newBalanceCommitment required" });
  }
  const result = claimNote(store, user, req.params.noteId, String(newBalanceCommitment));
  if (!result.ok) return res.status(422).json(result);
  res.json(result);
});

/**
 * Class 0 opening migration — same balance, new Compact persistentCommit opening.
 * Burns the old balance nullifier so the prior commitment cannot be reused.
 */
/**
 * Private strategy commitment — weight stays a Compact witness; ledger sees commitment only.
 */
app.post("/api/users/:id/strategy/commit", async (req, res) => {
  const user = findUser(req.params.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  try {
    const weight = BigInt(req.body?.weight ?? 0);
    const opening = String(req.body?.opening ?? "");
    const strategyCommitment = String(req.body?.strategyCommitment ?? "");
    let strategyId = String(req.body?.strategyId ?? "").replace(/^0x/, "");
    if (!/^[0-9a-fA-F]{64}$/.test(opening) || !/^[0-9a-fA-F]{64}$/.test(strategyCommitment)) {
      return res.status(400).json({
        error: "opening + strategyCommitment (32-byte hex) required",
      });
    }
    if (!/^[0-9a-fA-F]{64}$/.test(strategyId)) {
      const { createHash } = await import("node:crypto");
      strategyId = createHash("sha256")
        .update(`circled:strategy:${user.id}:${strategyCommitment}`)
        .digest("hex");
    }
    const { compactBalanceCommit, hexToOpening } = await import("./services/compactCommit.js");
    const expected = compactBalanceCommit(weight, hexToOpening(opening));
    if (expected !== strategyCommitment.toLowerCase() && expected !== strategyCommitment) {
      // compare case-insensitive
      if (expected.toLowerCase() !== strategyCommitment.toLowerCase()) {
        return res.status(422).json({ ok: false, reason: "commitment does not match weight+opening" });
      }
    }
    const { runStrategyCommitment, artifactsPresent } = await import(
      "./services/compactLedger.js"
    );
    if (!artifactsPresent()) {
      return res.status(503).json({ ok: false, reason: "Compact artifacts missing" });
    }
    const compact = await runStrategyCommitment({
      strategyCommitment: strategyCommitment.toLowerCase(),
      strategyId: strategyId.toLowerCase(),
      witness: { weight, opening },
    });
    res.json({
      ok: true,
      circuit: "prove_strategy_commitment",
      strategyCommitment: strategyCommitment.toLowerCase(),
      strategyId: strategyId.toLowerCase(),
      compactProved: true,
      transferCount: compact.ledger.transferCount,
      proofDataPresent: Boolean(compact.proofData),
    });
  } catch (e) {
    res.status(500).json({
      ok: false,
      reason: e instanceof Error ? e.message : String(e),
    });
  }
});

app.post("/api/users/:id/reseal-balance", (req, res) => {
  const user = findUser(req.params.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  const oldBalanceCommitment = String(req.body?.oldBalanceCommitment ?? "");
  const newBalanceCommitment = String(req.body?.newBalanceCommitment ?? "");
  if (!oldBalanceCommitment || !newBalanceCommitment) {
    return res.status(400).json({ error: "oldBalanceCommitment and newBalanceCommitment required" });
  }
  if (oldBalanceCommitment === newBalanceCommitment) {
    return res.json({ ok: true, balanceCommitment: user.balanceCommitment, noop: true });
  }
  if (user.balanceCommitment !== oldBalanceCommitment) {
    return res.status(422).json({ ok: false, reason: "Stale balance commitment — reload vault" });
  }
  const nf = sha256(`balnf:${oldBalanceCommitment}`);
  if (!store.spentNullifiers.includes(nf)) store.spentNullifiers.push(nf);
  user.balanceCommitment = newBalanceCommitment;
  saveStore(store);
  res.json({ ok: true, balanceCommitment: newBalanceCommitment });
});

app.get("/api/users/:id/vault", (req, res) => {
  const meta = getVaultMeta(store, req.params.id);
  if (!meta) return res.status(404).json({ error: "No vault" });
  res.json({ ...meta, coordinator: compliance.recoveryCoordinator.status(req.params.id) });
});

app.post("/api/users/:id/vault/enroll", (req, res) => {
  const user = findUser(req.params.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  const vaultCiphertext = String(req.body?.vaultCiphertext ?? "");
  if (!vaultCiphertext) {
    return res.status(400).json({ error: "vaultCiphertext required" });
  }
  try {
    const vault = provisionCloudVaultMeta(store, user.id, vaultCiphertext);
    res.json({ ok: true, ...vault });
  } catch (e) {
    res.status(500).json({
      error: e instanceof Error ? e.message : "Vault enroll failed",
    });
  }
});

app.post("/api/users/:id/vault/recover", (req, res) => {
  try {
    const { holderIds } = req.body ?? {};
    if (!Array.isArray(holderIds)) {
      return res.status(400).json({ error: "holderIds[] required" });
    }
    const release = releaseSharesForRecovery(store, req.params.id, holderIds);
    res.json({
      ...release,
      coordinator: compliance.recoveryCoordinator.status(req.params.id),
      processor: compliance.recoveryCoordinator.processorDisclosure(),
      note: "Decrypt Class 0 on device — server returns ciphertext + shares only",
    });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "recover failed" });
  }
});

app.post("/api/kyc/revoke", (req, res) => {
  const { userId, nullifier, reasonCode = "FRAUD" } = req.body ?? {};
  let nf = nullifier ? String(nullifier) : "";
  if (!nf && userId) {
    const user = findUser(String(userId));
    if (user) nf = user.kycNullifier;
  }
  if (!nf) return res.status(404).json({ error: "KYC leaf not found" });
  const leaf = store.kycLeaves.find((l) => l.nullifier === nf);
  if (!leaf) return res.status(404).json({ error: "KYC leaf not found" });
  const event = compliance.revocation.revokeByNullifier(
    nf,
    reasonCode as
      | "FRAUD"
      | "COURT_ORDER"
      | "SANCTIONS_UPDATE"
      | "SANCTIONS_STALE"
      | "USER_REQUEST"
      | "OTHER"
  );
  res.json({
    revoked: true,
    nullifierHint: `${event.nullifier.slice(0, 10)}…`,
    reasonCode: event.reasonCode,
    eventId: event.id,
    kycRegistryRoot: store.kycRoot,
  });
});

app.post("/api/users/:id/view-key", (req, res) => {
  const user = findUser(req.params.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json(compliance.selectiveDisclosure.issueViewKeyCommitment(user));
});

app.post("/api/users/:id/auditor-proof", (req, res) => {
  try {
    const user = findUser(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    const { viewKey, payload } = req.body ?? {};
    if (!viewKey || !payload) {
      return res.status(400).json({ error: "viewKey and client payload required" });
    }
    res.json(
      compliance.selectiveDisclosure.attestAuditorProof(
        user,
        String(viewKey),
        payload as Record<string, unknown>
      )
    );
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "auditor proof failed" });
  }
});

app.post("/api/seed/peer", (req, res) => {
  if (cfg.isProduction && process.env.NYXPAY_ALLOW_DEMO_SEED !== "1") {
    return res.status(403).json({ error: "Peer seed disabled in production" });
  }
  try {
    const {
      displayName = "Janhvi",
      documentReferenceHash,
      publicKeyJwk,
      balanceCommitment,
      policyCommitment,
      deviceId,
    } = req.body ?? {};
    const existing = store.users.find(
      (u) => u.displayName.toLowerCase() === String(displayName).toLowerCase()
    );
    if (existing) return res.json({ user: publicUser(existing), seeded: false, kycRoot: store.kycRoot });

    if (!documentReferenceHash || !publicKeyJwk || !balanceCommitment || !policyCommitment) {
      return res.status(400).json({
        error: "Peer must be registered from device with commitments (no server-side keygen)",
      });
    }

    const pubkey = pubkeyThumbprint(publicKeyJwk as JsonWebKey);
    const kyc = issueKyc(store, {
      identityDocumentHash: String(documentReferenceHash),
      jurisdiction: "IN",
      pubkey,
    });
    compliance.kycRegistry.publishCommitment(kyc);
    const user = createPublicAccount(store, {
      displayName: String(displayName),
      deviceId: String(deviceId || `peer-${randomNonce(4)}`),
      kyc,
      publicKeyJwk: publicKeyJwk as JsonWebKey,
      balanceCommitment: String(balanceCommitment),
      policyCommitment: String(policyCommitment),
      policyActive: ["T1", "T5"],
    });
    saveStore(store);
    res.json({ user: publicUser(user), seeded: true, kycRoot: store.kycRoot });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "seed failed" });
  }
});

if (cfg.isStrict) {
  const dist = join(__dirname, "../dist");
  app.use(express.static(dist));
  app.use((_req, res) => {
    res.sendFile(join(dist, "index.html"));
  });
}

export { app, store, compliance };

function startBackgroundLoops() {
  setInterval(() => {
    try {
      compliance.settlementRelay.emitDecoy();
    } catch {
      /* ignore */
    }
  }, 45_000);
  setInterval(() => {
    try {
      compliance.settlementRelay.purgeClass3();
      compliance.enrollmentRelay.purgeExpired();
    } catch {
      /* ignore */
    }
  }, 60 * 60 * 1000);
  setInterval(() => {
    try {
      compliance.sanctionsRescreen.rescreen();
    } catch {
      /* ignore */
    }
  }, SANCTIONS_RESCREEN_MS);
  setInterval(() => {
    try {
      compliance.settlementRelay.flush();
    } catch {
      /* ignore */
    }
  }, 5_000);
}

/** Last-resort error handler — never leak stacks in production */
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const message = err instanceof Error ? err.message : "Internal error";
  if (message === "CORS blocked") {
    return res.status(403).json({ error: "CORS blocked" });
  }
  console.error("[circled] unhandled", err);
  res.status(500).json({
    error: cfg.isProduction ? "Internal server error" : message,
  });
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  app.listen(PORT, cfg.bindHost, () => {
    console.log(`Circle production backend on http://${cfg.bindHost}:${PORT}`);
    startBackgroundLoops();
    // Prefetch Midnight prover keys so first payment SNARK isn't cold
    void warmProverKeys().then((w) => {
      if (w.warmed.length) {
        console.log(`[circled] prover keys warm: ${w.warmed.join(", ")}`);
      }
    });
  });
}
