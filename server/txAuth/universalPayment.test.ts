/**
 * Circled universal (rail-agnostic) payment — Phases 1–8 exit criteria.
 * Destination is opaque; rails differ only in adapters.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";

describe("Circled universal rail-agnostic payment", () => {
  const dirs: string[] = [];

  beforeEach(() => {
    vi.resetModules();
    delete process.env.MERCHANT_HSM_URL;
    const dir = mkdtempSync(join(tmpdir(), "circled-univ-"));
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
    const tx = await import("./index.js");
    const rx = await import("../receivePay/index.js");
    const store = loadStore();
    tx.ensureDemoMerchants(store);
    return { store, tx, rx };
  }

  it("Phase 1: commitment identical handling across rails — no rail branch", async () => {
    const { tx } = await boot();
    const base = {
      merchant_identifier: "nike.com",
      order_reference: "ORD-P1",
      amount: 10,
      currency: "USD",
      settlement_destination: "opaque-dest-1",
      nonce: "n-p1",
      timestamp: 1_700_000_000_000,
    };
    const rails = ["ethereum", "upi", "iban"] as const;
    const commits = rails.map((settlement_rail) =>
      tx.commitIntent({ ...base, settlement_rail }).intent_commitment
    );
    // Different rails → different commitments (rail is a bound field)
    expect(new Set(commits).size).toBe(3);
    // Same rail/destination shape must be stable
    const again = tx.commitIntent({ ...base, settlement_rail: "ethereum" }).intent_commitment;
    expect(again).toBe(commits[0]);
    // Canonical payload must not contain rail-specific if/else artifacts — just JSON fields
    const payload = tx.commitIntent({ ...base, settlement_rail: "upi" }).canonical_payload;
    expect(payload).toContain('"settlement_rail":"upi"');
    expect(payload).toContain('"settlement_destination":"opaque-dest-1"');
  });

  it(
    "Phase 2: proof fails when any single intent field differs",
    async () => {
      const { store, tx } = await boot();
      const intent = {
        merchant_identifier: "nike.com",
        order_reference: "ORD-P2",
        amount: 50,
        currency: "USD",
        settlement_rail: "upi",
        settlement_destination: "vpa_demo@nykpay",
        nonce: "n-p2",
        timestamp: Date.now(),
      };
      const { intent_commitment } = tx.commitIntent(intent);
      const challenge = tx.issueChallenge(store, { intent_commitment });
      const auth = await tx.authorizeIntent(store, { intent, intent_commitment });
      expect(auth.ok).toBe(true);
      if (!auth.ok) return;
      const proved = await tx.generateAuthorizedTxProof(store, {
        merchant_identifier: "nike.com",
        intent_commitment,
        challenge_id: challenge.challenge_id,
        authorization: auth.authorization,
      });
      expect(proved.ok).toBe(true);
      if (!proved.ok) return;

      for (const tamper of [
        { ...intent, amount: 51 },
        { ...intent, order_reference: "ORD-P2-X" },
        { ...intent, settlement_destination: "other@nykpay" },
      ]) {
        const bad = tx.verifyAuthorizedTransaction(store, {
          intent: tamper,
          intent_commitment,
          challenge_id: challenge.challenge_id,
          proof: proved.proof,
        });
        expect(bad.authorized).toBe(false);
        if (!bad.authorized) expect(bad.reason).toBe("intent_commitment_mismatch");
      }
    },
    60_000
  );

  it("Phase 2: expired challenge rejected", async () => {
    const { store, tx } = await boot();
    const intent = {
      merchant_identifier: "apple.com",
      order_reference: "ORD-EXP",
      amount: 5,
      currency: "USD",
      settlement_rail: "card",
      settlement_destination: "tok_card_demo",
      nonce: "n-exp",
      timestamp: Date.now(),
    };
    const { intent_commitment } = tx.commitIntent(intent);
    const challenge = tx.issueChallenge(store, { intent_commitment });
    // Force expiry
    const s = tx.txAuthState(store);
    s.challenges[challenge.challenge_id]!.expires_at = Date.now() - 1;
    const consumed = tx.consumeChallenge(store, challenge.challenge_id);
    expect(consumed.ok).toBe(false);
    if (!consumed.ok) expect(consumed.reason).toBe("challenge_mismatch_or_expired");
  });

  it(
    "Phase 3: same circuit verifies crypto + UPI with zero core changes",
    async () => {
      const { store, tx } = await boot();
      for (const rail of ["ethereum", "upi"] as const) {
        const result = await tx.runAuthorizeWorkflow(store, {
          merchant_identifier: "nike.com",
          order_reference: `ORD-P3-${rail}`,
          amount: 20,
          currency: "USD",
          settlement_rail: rail,
          settlement_destination:
            rail === "upi" ? "vpa_test@nykpay" : "inv_ethereum_deadbeef",
          settle: true,
        });
        expect(result.verification.authorized).toBe(true);
        expect(result.settlement?.ok).toBe(true);
        expect(result.settlement?.rail).toBe(rail);
      }
      expect(tx.listSettlementRails()).toContain("iban");
      expect(tx.listSettlementRails()).toContain("pix");
    },
    90_000
  );

  it("Phases 4–6: JIT mint · unmatched flag · buyer three states", async () => {
    const { store, rx } = await boot();
    const minted = rx.mintDestination(store, {
      intent: {
        merchant_identifier: "shop.acme.example",
        order_reference: "ORD-P456",
        amount: 99,
        currency: "USD",
        settlement_rail: "iban",
        nonce: "n456",
        timestamp: Date.now(),
      },
    });
    expect(minted.ok).toBe(true);
    if (!minted.ok) return;
    expect(minted.destination.settlement_destination).toMatch(/^iban_ref_/);
    expect(minted.destination.destination_spent).toBe(true);

    // Buyer: payment sent, not yet matched
    let buyer = rx.resolveBuyerPaymentState(store, {
      intent_commitment: minted.intent_commitment,
      payment_sent: true,
    });
    expect(buyer.state).toBe("payment_sent");

    // Unmatched orphan inbound
    const orphan = rx.observeInbound(store, {
      order_reference: "ORD-DOES-NOT-EXIST",
      payment_ref: "pay_orphan",
      amount: 1,
    });
    expect(orphan.ok).toBe(false);
    if (!orphan.ok) expect(orphan.reason).toBe("unmatched_inbound");
    expect(rx.listUnmatched(store).length).toBeGreaterThan(0);

    // Matched inbound
    const obs = rx.observeInbound(store, {
      order_reference: "ORD-P456",
      payment_ref: "pay_ok",
      amount: 99,
      currency: "USD",
      settlement_destination: minted.destination.settlement_destination,
    });
    expect(obs.ok).toBe(true);

    buyer = rx.resolveBuyerPaymentState(store, {
      intent_commitment: minted.intent_commitment,
      payment_sent: true,
    });
    expect(buyer.state).toBe("payment_sent_not_yet_matched");

    await rx.reconcileByOrderRef(store, "ORD-P456");
    const conf = await rx.issueSettlementConfirmation(store, {
      order_reference: "ORD-P456",
    });
    expect(conf.ok).toBe(true);

    buyer = rx.resolveBuyerPaymentState(store, {
      intent_commitment: minted.intent_commitment,
    });
    expect(buyer.state).toBe("payment_received_and_matched");
  });

  it("Phase 7: credit digest binds to intent_commitment", async () => {
    const { rx } = await boot();
    const d1 = rx.creditInboundDigest({
      intent_commitment: "aa".repeat(32),
      settlement_destination: "dest",
      amount: 10,
    });
    const d2 = rx.creditInboundDigest({
      intent_commitment: "bb".repeat(32),
      settlement_destination: "dest",
      amount: 10,
    });
    expect(d1).not.toBe(d2);
    expect(
      rx.assertCreditBoundToIntent("aa".repeat(32), d1, "dest", 10)
    ).toBe(true);
    expect(
      rx.assertCreditBoundToIntent("bb".repeat(32), d1, "dest", 10)
    ).toBe(false);
  });

  it(
    "Phase 8: PIX rail added adapter-only — full flow, zero core changes",
    async () => {
      const { store, tx, rx } = await boot();
      // Auth on PIX
      const auth = await tx.runAuthorizeWorkflow(store, {
        merchant_identifier: "nike.com",
        order_reference: "ORD-PIX-1",
        amount: 33,
        currency: "BRL",
        settlement_rail: "pix",
        settlement_destination: "pix_placeholder",
        settle: true,
      });
      expect(auth.verification.authorized).toBe(true);
      expect(auth.settlement?.rail).toBe("pix");

      // Receive flow on PIX (JIT mint via adapter)
      const recv = await rx.runReceiveWorkflow(store, {
        merchant_identifier: "nike.com",
        order_reference: "ORD-PIX-RECV",
        amount: 33,
        currency: "BRL",
        settlement_rail: "pix",
        simulate_inbound: true,
        run_credit: true,
      });
      expect(recv.ok).toBe(true);
      expect(recv.destination?.settlement_destination).toMatch(/^pix_/);
      expect(recv.exit_criterion.destination_never_reused).toBe(true);
      expect(recv.attestation?.circuit).toBe("prove_credit_update");

      // Runtime adapter registration (new rail after plan scope)
      const { registerRailAdapter } = await import("./rails/index.js");
      const { asOpaqueDestination } = await import("./types.js");
      registerRailAdapter({
        id: "lightning",
        label: "Lightning (post-plan rail)",
        mintDestination(input) {
          const h = createHash("sha256")
            .update(`ln:${input.order_reference}|${input.nonce}`)
            .digest("hex");
          return asOpaqueDestination(`lninv_${h.slice(0, 32)}`);
        },
        async settle(req) {
          return {
            ok: true,
            rail: "lightning",
            settlement_id: "stl_ln_test",
            routed_at: new Date().toISOString(),
            note: `LN ok ${req.intent_commitment.slice(0, 8)}`,
          };
        },
      });
      expect(tx.listSettlementRails()).toContain("lightning");
      const ln = await tx.runAuthorizeWorkflow(store, {
        merchant_identifier: "apple.com",
        order_reference: "ORD-LN-1",
        amount: 1,
        currency: "USD",
        settlement_rail: "lightning",
        settlement_destination: "lninv_demo",
        settle: true,
      });
      expect(ln.verification.authorized).toBe(true);
      expect(ln.settlement?.rail).toBe("lightning");
    },
    120_000
  );
});
