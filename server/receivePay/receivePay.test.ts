import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("receiving-payment (Phase 10)", () => {
  const dirs: string[] = [];

  beforeEach(() => {
    vi.resetModules();
    const dir = mkdtempSync(join(tmpdir(), "circled-recv-"));
    dirs.push(dir);
    process.env.NYXPAY_STORE_PATH = join(dir, "store.db");
  });

  afterEach(async () => {
    try {
      const { closeStore } = await import("../services/store.js");
      closeStore();
    } catch {
      /* ignore */
    }
    delete process.env.NYXPAY_STORE_PATH;
    vi.resetModules();
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  async function boot() {
    const { loadStore } = await import("../services/store.js");
    const rx = await import("./index.js");
    const store = loadStore();
    return { store, rx };
  }

  it(
    "meets exit criterion: receive · reconcile · confirm · credit · no dest reuse",
    async () => {
      const { resetCompactLedger } = await import("../services/compactLedger.js");
      resetCompactLedger();
      const { store, rx } = await boot();
      const result = await rx.runReceiveWorkflow(store, {
        merchant_identifier: "nike.com",
        order_reference: "ORD-RECV-1001",
        amount: 42.5,
        currency: "USD",
        settlement_rail: "midnight",
        simulate_inbound: true,
        run_credit: true,
      });

      expect(result.ok).toBe(true);
      expect(result.exit_criterion.received).toBe(true);
      expect(result.exit_criterion.reconciled_by_order_ref).toBe(true);
      expect(result.exit_criterion.settlement_confirmed).toBe(true);
      expect(result.exit_criterion.private_balance_credited).toBe(true);
      expect(result.exit_criterion.destination_never_reused).toBe(true);
      expect(result.destination?.settlement_destination).toMatch(/^inv_midnight_/);
      expect(result.destination?.destination_spent).toBe(true);
      expect(result.confirmation?.confirmation_signature).toBeTruthy();
      expect(result.attestation?.circuit).toBe("prove_credit_update");
      expect(result.attestation?.compact_ok).toBe(true);
    },
    300_000
  );

  it("mints a unique destination per order_ref and forbids reuse", async () => {
    const { store, rx } = await boot();
    const a = rx.mintDestination(store, {
      intent: {
        merchant_identifier: "apple.com",
        order_reference: "ORD-A",
        amount: 10,
        currency: "USD",
        settlement_rail: "ethereum",
        nonce: "n1",
        timestamp: Date.now(),
      },
    });
    expect(a.ok).toBe(true);
    if (!a.ok) return;

    const dupOrder = rx.mintDestination(store, {
      intent: {
        merchant_identifier: "apple.com",
        order_reference: "ORD-A",
        amount: 10,
        currency: "USD",
        settlement_rail: "ethereum",
        nonce: "n2",
        timestamp: Date.now(),
      },
    });
    expect(dupOrder.ok).toBe(false);

    const b = rx.mintDestination(store, {
      intent: {
        merchant_identifier: "apple.com",
        order_reference: "ORD-B",
        amount: 11,
        currency: "USD",
        settlement_rail: "ethereum",
        nonce: "n3",
        timestamp: Date.now(),
      },
    });
    expect(b.ok).toBe(true);
    if (!b.ok) return;
    expect(b.destination.settlement_destination).not.toBe(
      a.destination.settlement_destination
    );
    expect(rx.assertDestinationUnused(store, a.destination.settlement_destination)).toBe(
      false
    );
  });

  it("reconciles by order_ref and rejects amount mismatch", async () => {
    const { store, rx } = await boot();
    const minted = rx.mintDestination(store, {
      intent: {
        merchant_identifier: "shop.acme.example",
        order_reference: "ORD-C",
        amount: 99,
        currency: "USD",
        settlement_rail: "upi",
        nonce: "n4",
        timestamp: Date.now(),
      },
    });
    expect(minted.ok).toBe(true);
    if (!minted.ok) return;

    const bad = rx.observeInbound(store, {
      order_reference: "ORD-C",
      payment_ref: "pay_bad",
      amount: 1,
    });
    expect(bad.ok).toBe(false);
    if (bad.ok) return;
    expect(bad.reason).toBe("amount_mismatch");

    const ok = rx.observeInbound(store, {
      order_reference: "ORD-C",
      payment_ref: "pay_ok",
      amount: 99,
      settlement_destination: minted.destination.settlement_destination,
    });
    expect(ok.ok).toBe(true);

    const rec = rx.reconcileByOrderRef(store, "ORD-C");
    expect(rec.ok).toBe(true);
    if (!rec.ok) return;
    expect(rec.destination.status).toBe("reconciled");
  });

  it("issues and verifies settlement confirmation over intent_commitment", async () => {
    const { store, rx } = await boot();
    const flow = await rx.runReceiveWorkflow(store, {
      merchant_identifier: "nike.com",
      order_reference: "ORD-CFM",
      amount: 5,
      currency: "USD",
      settlement_rail: "card",
      run_credit: false,
    });
    expect(flow.ok).toBe(true);
    expect(flow.confirmation).toBeTruthy();
    const v = rx.verifySettlementConfirmation(store, flow.confirmation!);
    expect(v.ok).toBe(true);

    const tampered = {
      ...flow.confirmation!,
      confirmation_signature: "deadbeef",
    };
    const bad = rx.verifySettlementConfirmation(store, tampered);
    expect(bad.ok).toBe(false);
  });

  it("exposes skill document with prove_credit_update", async () => {
    const { store, rx } = await boot();
    const doc = rx.skillDocument(store);
    expect(doc.name).toBe("receiving-payment");
    expect(doc.circuit).toBe("prove_credit_update");
    expect(doc.endpoints.receive).toContain("receiving-payment/receive");
  });
});
