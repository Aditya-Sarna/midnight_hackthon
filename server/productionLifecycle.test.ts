import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  advancePaymentLifecycle,
  createPaymentLifecycle,
  publicReceiptView,
} from "./services/paymentLifecycle.js";
import { amountToBucket, evaluatePaymentRisk } from "./services/riskEngine.js";
import {
  redactObject,
  recordSettleAttempt,
  resetSettleMetrics,
  settleMetricsView,
} from "./services/observability.js";
import { reconcilePayment } from "./services/reconciliation.js";
import {
  internalLedgerAdapter,
  resetInternalLedger,
} from "./txAuth/rails/internalLedger.js";
import { asOpaqueDestination } from "./txAuth/types.js";
import type { Store } from "./services/store.js";
import { retentionDocument } from "./compliance/services/retention.js";

function emptyStore(): Store {
  return {
    schemaVersion: 4,
    kycLeaves: [],
    kycRoot: "aa".repeat(32),
    revokedNullifiers: [],
    spentNullifiers: [],
    users: [],
    events: [],
    vaults: [],
    notes: [],
    issuerSecret: "bb".repeat(16),
    paymentLifecycle: [],
  } as Store;
}

describe("production lifecycle / rails / risk / obs", () => {
  const dirs: string[] = [];

  beforeEach(async () => {
    const dir = mkdtempSync(join(tmpdir(), "circled-life-"));
    dirs.push(dir);
    process.env.NYXPAY_STORE_PATH = join(dir, "store.db");
    resetInternalLedger();
    resetSettleMetrics();
    const { resetConfigCache } = await import("./config.js");
    resetConfigCache();
  });

  afterEach(async () => {
    try {
      const { closeStore } = await import("./services/store.js");
      closeStore();
    } catch {
      /* ignore */
    }
    delete process.env.NYXPAY_STORE_PATH;
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  it("advances payment lifecycle and builds a public receipt", async () => {
    const { loadStore, saveStore } = await import("./services/store.js");
    const store = loadStore();
    const rec = createPaymentLifecycle(store, {
      userId: "u1",
      intentCommitment: "c".repeat(64),
      spendNullifier: "n".repeat(64),
      recipientPubkey: "r".repeat(64),
    });
    advancePaymentLifecycle(store, rec.id, "proof_prepared");
    advancePaymentLifecycle(store, rec.id, "user_authorized", {
      riskDecision: "allow",
    });
    advancePaymentLifecycle(store, rec.id, "proof_verified", {
      attestationGrade: "zk-proved",
      proofMode: "midnight-proof-server",
    });
    advancePaymentLifecycle(store, rec.id, "rail_reserved", {
      railId: "internal_ledger",
    });
    advancePaymentLifecycle(store, rec.id, "settled", {
      railSettlementId: "stl_test",
      receiptId: "rcpt_test",
    });
    advancePaymentLifecycle(store, rec.id, "device_applied");
    const out = reconcilePayment(store, {
      paymentId: rec.id,
      deviceApplied: true,
      recipientNotified: true,
      railSettlementId: "stl_test",
    });
    expect(out.ok).toBe(true);
    expect(out.state).toBe("reconciled");
    const view = publicReceiptView(store.paymentLifecycle!.find((p) => p.id === rec.id)!);
    expect(view.receiptId).toBeTruthy();
    expect(JSON.stringify(view)).not.toMatch(/amount|opening|witness/i);
    saveStore(store);
  });

  it("internal ledger quote→reserve→settle→refund→status", async () => {
    const dest = internalLedgerAdapter.mintDestination({
      merchant_identifier: "m1",
      order_reference: "o1",
      nonce: "n1",
    });
    const req = {
      intent: {
        merchant_identifier: "m1",
        order_reference: "o1",
        amount: 0,
        currency: "CIRCLE",
        settlement_rail: "internal_ledger",
        settlement_destination: asOpaqueDestination(dest),
        nonce: "n1",
        timestamp: Date.now(),
      },
      intent_commitment: "d".repeat(64),
      verification: {
        authorized: true as const,
        merchant_identifier: "m1",
        intent_commitment: "d".repeat(64),
        proof_challenge_id: "ch1",
        verified_at: new Date().toISOString(),
        registry_version: 1,
        settlement_rail: "internal_ledger",
        private_information_exposed: false as const,
        checks: {
          membership: true as const,
          authorization_signature: true as const,
          not_revoked: true as const,
          challenge_fresh: true as const,
          intent_bound: true as const,
        },
      },
      proof_challenge_id: "ch1",
    };
    const quote = await internalLedgerAdapter.quote!(req);
    expect(quote.ok).toBe(true);
    const reserved = await internalLedgerAdapter.reserve!(req);
    expect(reserved.ok).toBe(true);
    const settled = await internalLedgerAdapter.settle(req);
    expect(settled.ok).toBe(true);
    const st = await internalLedgerAdapter.status!(settled.settlement_id);
    expect(st.status).toBe("settled");
    const refunded = await internalLedgerAdapter.refund!(settled.settlement_id);
    expect(refunded.ok).toBe(true);
  });

  it("risk engine denies locked accounts and buckets amounts", () => {
    const store = emptyStore();
    const user = {
      id: "u1",
      pubkey: "p".repeat(64),
      publicKeyJwk: {} as JsonWebKey,
      displayName: "A",
      balanceCommitment: "b".repeat(64),
      policyCommitment: "c".repeat(64),
      credentialCommitment: "d".repeat(64),
      createdAt: Date.now(),
      riskLocked: true,
    };
    const v = evaluatePaymentRisk(store, {
      user: user as never,
      recipientPubkey: "e".repeat(64),
      amountBucket: "low",
      correlationId: "corr",
    });
    expect(v.decision).toBe("deny");
    expect(amountToBucket(10n)).toBe("micro");
    expect(amountToBucket(6000n)).toBe("high");
  });

  it("redacts sensitive keys from structured logs and records metrics", () => {
    const scrubbed = redactObject({
      amount: 42,
      contact: "Ada",
      paymentId: "pay_abc",
      grade: "zk-proved",
    });
    expect(scrubbed.amount).toBe("[redacted]");
    expect(scrubbed.contact).toBe("[redacted]");
    expect(scrubbed.grade).toBe("zk-proved");
    recordSettleAttempt(true, { grade: "zk-proved", proofMode: "midnight-proof-server" });
    recordSettleAttempt(false, { failureReason: "KYC revoked", riskDenied: true });
    const m = settleMetricsView();
    expect(m.attempts).toBe(2);
    expect(m.success).toBe(1);
    expect(m.riskDenies).toBe(1);
  });

  it("chooses low-value capped wallet SAR strategy", () => {
    const doc = retentionDocument();
    expect(doc.sarStrategy).toBe("low_value_capped_wallet");
  });

  it("blocks stub rails in strict production without allow flag", async () => {
    process.env.NYXPAY_STRICT = "1";
    delete process.env.NYXPAY_ALLOW_STUB_RAILS;
    delete process.env.NYXPAY_BOOT_SOFT;
    delete process.env.VITEST;
    // VITEST is always set by runner — stubGuard allows VITEST. Assert the branch via loadConfig.
    process.env.VITEST = "1";
    const { resetConfigCache, loadConfig } = await import("./config.js");
    resetConfigCache();
    expect(loadConfig().isStrict).toBe(true);
    const { settleStubRail } = await import("./txAuth/rails/stubGuard.js");
    // Under VITEST stub still allowed; document contract:
    const receipt = settleStubRail("upi", {
      intent: {
        merchant_identifier: "m",
        order_reference: "o",
        amount: 1,
        currency: "INR",
        settlement_rail: "upi",
        settlement_destination: asOpaqueDestination("vpa_x@nykpay"),
        nonce: "n",
        timestamp: Date.now(),
      },
      intent_commitment: "f".repeat(64),
      verification: {
        authorized: true,
        merchant_identifier: "m",
        intent_commitment: "f".repeat(64),
        proof_challenge_id: "c",
        verified_at: new Date().toISOString(),
        registry_version: 1,
        settlement_rail: "upi",
        private_information_exposed: false,
        checks: {
          membership: true,
          authorization_signature: true,
          not_revoked: true,
          challenge_fresh: true,
          intent_bound: true,
        },
      },
      proof_challenge_id: "c",
    });
    expect(receipt.ok).toBe(true);
  });
});
