import { afterEach, describe, expect, it, vi } from "vitest";

describe("enterprise 10 posture", () => {
  afterEach(async () => {
    delete process.env.NYXPAY_STRICT;
    delete process.env.NYXPAY_ALLOW_MERCHANT_AUTO_PROVE;
    delete process.env.NYXPAY_REQUIRE_ONCHAIN;
    delete process.env.NYXPAY_MERCHANT_SIGNING;
    vi.resetModules();
    const { resetConfigCache } = await import("./config.js");
    resetConfigCache();
  });

  it("disables merchant auto-prove in strict mode", async () => {
    process.env.NYXPAY_STRICT = "1";
    const { resetConfigCache } = await import("./config.js");
    resetConfigCache();
    const { allowMerchantAutoProve, resetMerchantSigner } = await import(
      "./services/merchantHsm.js"
    );
    resetMerchantSigner();
    expect(allowMerchantAutoProve()).toBe(false);
  });

  it("allows SoftHSM auto-prove only when explicitly opted in under strict", async () => {
    process.env.NYXPAY_STRICT = "1";
    process.env.NYXPAY_ALLOW_MERCHANT_AUTO_PROVE = "1";
    const { resetConfigCache } = await import("./config.js");
    resetConfigCache();
    const { allowMerchantAutoProve, resetMerchantSigner } = await import(
      "./services/merchantHsm.js"
    );
    resetMerchantSigner();
    expect(allowMerchantAutoProve()).toBe(true);
  });

  it("SoftHSM signs without exporting sealed secrets", async () => {
    const { sealSecret } = await import("./services/secretBox.js");
    const { getMerchantSigner, resetMerchantSigner } = await import(
      "./services/merchantHsm.js"
    );
    resetMerchantSigner();
    const sealed = sealSecret("merchant-demo-secret");
    expect(sealed.startsWith("enc:v1:")).toBe(true);
    const signer = getMerchantSigner();
    expect(signer.mode).toBe("software");
    const sig = await signer.sign({
      merchant_identifier: "nike.com",
      sealed_secret: sealed,
      message: "intent:test",
    });
    expect(sig).toMatch(/^[a-f0-9]{64}$/);
    expect(await signer.verify({
      merchant_identifier: "nike.com",
      sealed_secret: sealed,
      message: "intent:test",
    }, sig)).toBe(true);
  });

  it("compact spend/credit enforce Field arithmetic under persistentCommit", async () => {
    const {
      artifactsPresent,
      resetCompactLedger,
      runCompactCircuit,
      setSpendWitness,
      setCreditWitness,
    } = await import("./services/compactLedger.js");
    if (!artifactsPresent()) return;
    resetCompactLedger();
    const { compactBalanceCommit, randomOpening } = await import(
      "./services/compactCommit.js"
    );

    const oldOpen = randomOpening();
    const newOpen = randomOpening();
    setSpendWitness({
      oldBalance: 500n,
      amount: 40n,
      oldOpening: oldOpen,
      newOpening: newOpen,
    });
    const spend = await runCompactCircuit("prove_spend_update", [
      compactBalanceCommit(500n, oldOpen),
      compactBalanceCommit(460n, newOpen),
      "aa".repeat(32),
    ]);
    expect(spend.ok).toBe(true);
    expect(Number(spend.ledger.transferCount)).toBeGreaterThan(0);

    const cOld = randomOpening();
    const cNew = randomOpening();
    setCreditWitness({
      oldBalance: 0n,
      amount: 125n,
      oldOpening: cOld,
      newOpening: cNew,
    });
    const credit = await runCompactCircuit("prove_credit_update", [
      compactBalanceCommit(0n, cOld),
      compactBalanceCommit(125n, cNew),
      "bb".repeat(32),
    ]);
    expect(credit.ok).toBe(true);
    expect(Number(credit.ledger.creditCount)).toBeGreaterThan(0);
  });

  it("KYC membership uses HistoricMerkleTree path", async () => {
    const {
      artifactsPresent,
      resetCompactLedger,
      syncKycRoot,
      runCompactCircuit,
    } = await import("./services/compactLedger.js");
    if (!artifactsPresent()) return;
    resetCompactLedger();
    const leaf = "cc".repeat(32);
    const root = "dd".repeat(32);
    await syncKycRoot(root, leaf);
    const mem = await runCompactCircuit("prove_kyc_membership", [leaf, root]);
    expect(mem.ok).toBe(true);
    expect(mem.ledger.kycRegistryRoot).toBe(root);
  });
});
