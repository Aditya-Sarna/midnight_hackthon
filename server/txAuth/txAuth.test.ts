import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("rail-agnostic-tx-auth", () => {
  const dirs: string[] = [];

  beforeEach(() => {
    vi.resetModules();
    delete process.env.MERCHANT_HSM_URL;
    delete process.env.NYXPAY_MERCHANT_SIGNING;
    const dir = mkdtempSync(join(tmpdir(), "circled-txauth-"));
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
    const store = loadStore();
    tx.ensureDemoMerchants(store);
    return { store, tx };
  }

  it(
    "authorizes Nike intent across an arbitrary settlement rail",
    async () => {
      const { store, tx } = await boot();
      const result = await tx.runAuthorizeWorkflow(store, {
        merchant_identifier: "nike.com",
        order_reference: "ORD-10042",
        amount: 129.99,
        currency: "USD",
        settlement_rail: "upi",
        settlement_destination: "nike@upi",
        settle: true,
      });
      expect(result.verification.authorized).toBe(true);
      if (!result.verification.authorized) return;
      expect(result.verification.settlement_rail).toBe("upi");
      expect(result.verification.private_information_exposed).toBe(false);
      expect(result.settlement?.ok).toBe(true);
      expect(result.intent_commitment).toMatch(/^[a-f0-9]{64}$/);
    },
    60_000
  );

  it(
    "rejects modified intent after commitment",
    async () => {
    const { store, tx } = await boot();
    const intent = {
      merchant_identifier: "nike.com",
      order_reference: "ORD-X",
      amount: 50,
      currency: "USD",
      settlement_rail: "ethereum",
      settlement_destination: "0xabc",
      nonce: "n1",
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

    const tampered = { ...intent, amount: 999 };
    const bad = tx.verifyAuthorizedTransaction(store, {
      intent: tampered,
      intent_commitment,
      challenge_id: challenge.challenge_id,
      proof: proved.proof,
    });
    expect(bad.authorized).toBe(false);
    if (bad.authorized) return;
    expect(bad.reason).toBe("intent_commitment_mismatch");
    },
    60_000
  );

  it("rejects revoked merchants", async () => {
    const { store, tx } = await boot();
    const rev = tx.revokeMerchant(store, "nike.com");
    expect(rev.ok).toBe(true);

    const result = await tx.runAuthorizeWorkflow(store, {
      merchant_identifier: "nike.com",
      order_reference: "ORD-R",
      amount: 10,
      currency: "USD",
      settlement_rail: "ethereum",
      settlement_destination: "0x1",
    });
    expect(result.verification.authorized).toBe(false);
    if (result.verification.authorized) return;
    expect(result.verification.reason).toBe("nullifier_revoked");
  });

  it(
    "rejects replayed challenges",
    async () => {
    const { store, tx } = await boot();
    const first = await tx.runAuthorizeWorkflow(store, {
      merchant_identifier: "apple.com",
      order_reference: "ORD-A1",
      amount: 12,
      currency: "USD",
      settlement_rail: "bitcoin",
      settlement_destination: "bc1qdemo",
    });
    expect(first.verification.authorized).toBe(true);

    // Replaying the consumed challenge id must fail (even with a plausible proof shape)
    const merchant = tx.findMerchant(store, "apple.com")!;
    const auth = await tx.authorizeIntent(store, {
      intent: first.intent,
      intent_commitment: first.intent_commitment,
    });
    expect(auth.ok).toBe(true);
    if (!auth.ok) return;

    const bad = tx.verifyAuthorizedTransaction(store, {
      intent: first.intent,
      intent_commitment: first.intent_commitment,
      challenge_id: first.challenge_id,
      proof: {
        circuit: "prove_authorized_transaction",
        proof: "00".repeat(32),
        public_inputs: {
          brand_registry_root: first.registry.brand_registry_root,
          platform_challenge: first.platform_challenge,
          intent_commitment: first.intent_commitment,
        },
        leaf: merchant.leaf,
        nullifier: merchant.revocation_nullifier,
        intent_signature: auth.authorization.intent_signature,
        generated_at: Date.now(),
      },
    });
    expect(bad.authorized).toBe(false);
    if (bad.authorized) return;
    expect(bad.reason).toBe("challenge_mismatch_or_expired");
    },
    60_000
  );

  it("rejects unknown merchants with distinct reason", async () => {
    const { store, tx } = await boot();
    const result = await tx.runAuthorizeWorkflow(store, {
      merchant_identifier: "not-registered.example",
      order_reference: "ORD-Z",
      amount: 5,
      currency: "USD",
      settlement_rail: "card",
      settlement_destination: "tok_demo",
    });
    expect(result.verification.authorized).toBe(false);
    if (result.verification.authorized) return;
    expect(result.verification.reason).toBe("merchant_not_found");
  });

  it("rejects invalid authorization signatures", async () => {
    const { store, tx } = await boot();
    const intent = {
      merchant_identifier: "shop.acme.example",
      order_reference: "ORD-S",
      amount: 20,
      currency: "USD",
      settlement_rail: "solana",
      settlement_destination: "So11111111111111111111111111111111111111112",
      nonce: "sig-test",
      timestamp: Date.now(),
    };
    const { intent_commitment } = tx.commitIntent(intent);
    const challenge = tx.issueChallenge(store, { intent_commitment });
    const bad = tx.verifyAuthorizedTransaction(store, {
      intent,
      intent_commitment,
      challenge_id: challenge.challenge_id,
      proof: {
        circuit: "prove_authorized_transaction",
        proof: "aa".repeat(32),
        public_inputs: {
          brand_registry_root: tx.syncRegistry(store).brand_registry_root,
          platform_challenge: challenge.platform_challenge,
          intent_commitment,
        },
        leaf: tx.findMerchant(store, "shop.acme.example")!.leaf,
        nullifier: tx.findMerchant(store, "shop.acme.example")!.revocation_nullifier,
        intent_signature: "deadbeef",
        generated_at: Date.now(),
      },
    });
    expect(bad.authorized).toBe(false);
    if (bad.authorized) return;
    expect(bad.reason).toBe("authorization_signature_invalid");
  });

  it("syncs registry with integrity checks", async () => {
    const { store, tx } = await boot();
    const sync = tx.syncRegistry(store);
    expect(sync.ok).toBe(true);
    expect(sync.integrity.root_matches_live).toBe(true);
    expect(sync.merchant_count).toBeGreaterThanOrEqual(3);
  });

  it("exposes skill document and settlement rails", async () => {
    const { store, tx } = await boot();
    const doc = tx.skillDocument(store);
    expect(doc.name).toBe("rail-agnostic-tx-auth");
    expect(doc.circuit).toBe("prove_authorized_transaction");
    expect(doc.rails).toContain("midnight");
    expect(doc.endpoints.authorize).toContain("authorize");
  });
});
