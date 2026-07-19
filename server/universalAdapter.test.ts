import { beforeEach, describe, expect, it } from "vitest";
import "./test/mocks.js";
import { useServerHarness } from "./test/harness.js";
import {
  bindUniversalStore,
  createUniversalQuote,
  createUniversalRoute,
  getUniversalPayment,
  resetUniversalService,
  settleUniversal,
  simulateUniversalRestart,
} from "./services/universalService.js";
import {
  resetSandboxAccounts,
  setSandboxAccountKyc,
} from "./services/sandboxAccounts.js";

describe("universal adapter platform", () => {
  const harness = useServerHarness();

  beforeEach(() => {
    // Bind the in-process Maps to the harness store (survives resetModules isolation).
    bindUniversalStore(harness.store);
    resetUniversalService();
    resetSandboxAccounts();
    bindUniversalStore(harness.store);
  });

  it("lists assets, methods, sandbox accounts, route cards", async () => {
    const [assets, methods, accounts, cards] = await Promise.all([
      fetch(`${harness.baseUrl}/api/assets`).then((r) => r.json()),
      fetch(`${harness.baseUrl}/api/payment-methods`).then((r) => r.json()),
      fetch(`${harness.baseUrl}/api/universal/sandbox-accounts`).then((r) => r.json()),
      fetch(`${harness.baseUrl}/api/universal/route-cards`).then((r) => r.json()),
    ]);
    expect(assets.ok).toBe(true);
    expect(assets.assets.some((a: { code: string }) => a.code === "BTC")).toBe(true);
    expect(methods.methods.some((m: { id: string }) => m.id === "bitcoin_sandbox")).toBe(
      true
    );
    expect(accounts.accounts.map((a: { displayName: string }) => a.displayName)).toEqual(
      expect.arrayContaining(["Maya Chen", "Arjun Rao"])
    );
    expect(cards.cards).toHaveLength(4);
  });

  it("INR → USD happy path via API", async () => {
    const accounts = await fetch(
      `${harness.baseUrl}/api/universal/sandbox-accounts`
    ).then((r) => r.json());
    const maya = accounts.accounts.find(
      (a: { preferredAsset: string }) => a.preferredAsset === "USD"
    );
    const quoteRes = await fetch(`${harness.baseUrl}/api/universal/quote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId: maya.id, amount: "5000" }),
    });
    const quote = await quoteRes.json();
    expect(quoteRes.status).toBe(200);
    expect(quote.quoteId).toMatch(/^q_uni_/);

    const routeRes = await fetch(`${harness.baseUrl}/api/universal/route`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quoteId: quote.quoteId }),
    });
    const route = await routeRes.json();
    expect(route.routeId).toMatch(/^route_/);
    expect(route.binding.quoteId).toBe(quote.quoteId);
    expect(route.targetAdapter).toBe("stripe_test");

    const settleRes = await fetch(`${harness.baseUrl}/api/universal/sandbox-settle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quoteId: quote.quoteId,
        routeId: route.routeId,
        routeCommitment: route.routeCommitment,
      }),
    });
    const settle = await settleRes.json();
    expect(settleRes.status).toBe(200);
    expect(settle.receiptId).toMatch(/^rcpt_uni_/);
    expect(["reconciled", "settled"]).toContain(settle.lifecycleState);
    expect(settle.attestationGrade).toBeTruthy();
    expect(settle.circuit).toBe("prove_authorized_transaction");
    expect(settle.payment.sourceSettlementId).toBeTruthy();
    expect(settle.payment.targetSettlementId).toBeTruthy();
    expect(settle.payment.reconciliationGaps).toEqual([]);
    // Under harness mocks: compact-runtime. Live proof-server → zk-proved + snarkDigest.
    expect(["zk-proved", "compact-runtime", "structural"]).toContain(settle.attestationGrade);

    const refundRes = await fetch(`${harness.baseUrl}/api/universal/refund`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentId: settle.payment.id }),
    });
    const refund = await refundRes.json();
    expect(refundRes.status).toBe(200);
    expect(refund.payment.lifecycleState).toBe("refunded");

    const receipt = await fetch(
      `${harness.baseUrl}/api/universal/receipt/${settle.receiptId}`
    ).then((r) => r.json());
    expect(receipt.quoteId).toBe(quote.quoteId);
  });

  it("INR → BTC happy path", async () => {
    const { quote } = createUniversalQuote({
      accountId: "acct_arjun_btc",
      amount: "5000",
    });
    const { route, binding } = createUniversalRoute({ quoteId: quote.quoteId });
    expect(binding.targetAcceptance).toBe("BTC");
    const payment = await settleUniversal({
      quoteId: quote.quoteId,
      routeId: route.routeId,
      routeCommitment: route.routeCommitment,
    });
    expect(payment.targetAdapter).toBe("stripe_test");
    expect(payment.conversionAdapter).toBe("mock_fx");
  });

  it("rejects tampered route", async () => {
    const { quote } = createUniversalQuote({
      accountId: "acct_maya_usd",
      amount: "1000",
    });
    const { route } = createUniversalRoute({ quoteId: quote.quoteId });
    await expect(
      settleUniversal({
        quoteId: quote.quoteId,
        routeId: route.routeId,
        routeCommitment: route.routeCommitment,
        tamperRouteId: "route_btc_switched",
      })
    ).rejects.toThrow(/route commitment mismatch/i);
  });

  it("rejects wrong route commitment", async () => {
    const { quote } = createUniversalQuote({
      accountId: "acct_maya_usd",
      amount: "1000",
    });
    const { route } = createUniversalRoute({ quoteId: quote.quoteId });
    await expect(
      settleUniversal({
        quoteId: quote.quoteId,
        routeId: route.routeId,
        routeCommitment: "deadbeef".repeat(8),
      })
    ).rejects.toThrow(/route commitment mismatch/i);
  });

  it("rejects expired quote", async () => {
    const { quote } = createUniversalQuote({
      accountId: "acct_maya_usd",
      amount: "1000",
    });
    // Force expiry by mutating stored quote through route creation after clock skew
    const stored = createUniversalRoute({ quoteId: quote.quoteId });
    // Manually expire via settle after mutating expiresAt on route quote
    stored.route.quote.expiresAt = Date.now() - 1;
    await expect(
      settleUniversal({
        quoteId: quote.quoteId,
        routeId: stored.route.routeId,
        routeCommitment: stored.route.routeCommitment,
      })
    ).rejects.toThrow(/expired/i);
  });

  it("ops + judge command center expose metrics without private fields", async () => {
    const { quote } = createUniversalQuote({
      accountId: "acct_maya_usd",
      amount: "500",
    });
    const { route } = createUniversalRoute({ quoteId: quote.quoteId });
    await settleUniversal({
      quoteId: quote.quoteId,
      routeId: route.routeId,
      routeCommitment: route.routeCommitment,
    });

    const [ops, judge] = await Promise.all([
      fetch(`${harness.baseUrl}/api/ops/universal`).then((r) => r.json()),
      fetch(`${harness.baseUrl}/api/judge/command-center`).then((r) => r.json()),
    ]);
    expect(ops.metrics.settled).toBeGreaterThanOrEqual(1);
    expect(ops.persisted).toBe(true);
    expect(judge.ok).toBe(true);
    expect(judge.compact.circuits.length).toBeGreaterThan(0);
    const blob = JSON.stringify({ ops, judge });
    expect(blob).not.toMatch(/bc1q|4821|voice transcript|privateKey/i);
  });

  it("hard-blocks settle when KYC uncleared (INR → USD challenge)", async () => {
    setSandboxAccountKyc("acct_maya_usd", { kycStatus: "unverified" });
    const { quote } = createUniversalQuote({
      accountId: "acct_maya_usd",
      amount: "5000",
    });
    const { route } = createUniversalRoute({ quoteId: quote.quoteId });
    await expect(
      settleUniversal({
        quoteId: quote.quoteId,
        routeId: route.routeId,
        routeCommitment: route.routeCommitment,
      })
    ).rejects.toThrow(/Settle blocked: challenge/i);

    setSandboxAccountKyc("acct_maya_usd", { kycStatus: "sandbox_verified" });
    const payment = await settleUniversal({
      quoteId: quote.quoteId,
      routeId: route.routeId,
      routeCommitment: route.routeCommitment,
    });
    expect(payment.lifecycleState).toMatch(/reconciled|settled/);
  });

  it("verify API clears KYC for uncleared sandbox account", async () => {
    const created = await fetch(`${harness.baseUrl}/api/universal/sandbox-accounts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: "Pilot User", preferredAsset: "USD" }),
    }).then((r) => r.json());
    expect(created.account.kycStatus).toBe("unverified");

    const blocked = await fetch(`${harness.baseUrl}/api/universal/quote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId: created.account.id, amount: "1000" }),
    }).then(async (r) => {
      const quote = await r.json();
      const route = await fetch(`${harness.baseUrl}/api/universal/route`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quoteId: quote.quoteId }),
      }).then((rr) => rr.json());
      const settle = await fetch(`${harness.baseUrl}/api/universal/sandbox-settle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteId: quote.quoteId,
          routeId: route.routeId,
          routeCommitment: route.routeCommitment,
        }),
      });
      return settle;
    });
    expect(blocked.status).toBe(403);

    const verify = await fetch(
      `${harness.baseUrl}/api/universal/sandbox-accounts/${created.account.id}/verify`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level: "sandbox_verified" }),
      }
    );
    expect(verify.status).toBe(200);

    const quote2 = await fetch(`${harness.baseUrl}/api/universal/quote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId: created.account.id, amount: "1000" }),
    }).then((r) => r.json());
    const route2 = await fetch(`${harness.baseUrl}/api/universal/route`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quoteId: quote2.quoteId }),
    }).then((r) => r.json());
    const settle2 = await fetch(`${harness.baseUrl}/api/universal/sandbox-settle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quoteId: quote2.quoteId,
        routeId: route2.routeId,
        routeCommitment: route2.routeCommitment,
      }),
    });
    expect(settle2.status).toBe(200);
  });

  it("survives simulated restart — receipt + stripe ledger still present", async () => {
    const { quote } = createUniversalQuote({
      accountId: "acct_maya_usd",
      amount: "2500",
    });
    const { route } = createUniversalRoute({ quoteId: quote.quoteId });
    const payment = await settleUniversal({
      quoteId: quote.quoteId,
      routeId: route.routeId,
      routeCommitment: route.routeCommitment,
    });
    const receiptId = payment.receiptId;
    const targetSettlementId = payment.targetSettlementId;
    const paymentId = payment.id;

    expect(harness.store.universal?.payments?.[paymentId]?.receiptId).toBe(receiptId);

    simulateUniversalRestart();

    const restored = getUniversalPayment(receiptId);
    expect(restored?.receiptId).toBe(receiptId);
    expect(restored?.targetSettlementId).toBe(targetSettlementId);
    expect(restored?.lifecycleState).toMatch(/reconciled|settled/);
    expect(harness.store.universal?.stripeLedger?.ledger).toBeTruthy();
    expect(
      Object.keys(harness.store.universal?.stripeLedger?.ledger || {}).length
    ).toBeGreaterThan(0);
  });

  it("rejects reusing a quote after settle", async () => {
    const { quote } = createUniversalQuote({
      accountId: "acct_maya_usd",
      amount: "800",
    });
    const { route } = createUniversalRoute({ quoteId: quote.quoteId });
    await settleUniversal({
      quoteId: quote.quoteId,
      routeId: route.routeId,
      routeCommitment: route.routeCommitment,
    });
    expect(() => createUniversalRoute({ quoteId: quote.quoteId })).toThrow(/quote not found/i);
  });
});
