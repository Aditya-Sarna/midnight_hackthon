import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("production hardening", () => {
  const dirs: string[] = [];

  beforeEach(() => {
    vi.resetModules();
    const dir = mkdtempSync(join(tmpdir(), "circled-prod-"));
    dirs.push(dir);
    process.env.NYXPAY_STORE_PATH = join(dir, "store.db");
    process.env.MERCHANT_KEK = "ab".repeat(32);
    delete process.env.NYXPAY_STRICT;
    delete process.env.NYXPAY_REQUIRE_PROOFS;
    delete process.env.NODE_ENV;
  });

  afterEach(async () => {
    try {
      const { closeStore } = await import("./services/store.js");
      closeStore();
    } catch {
      /* ignore */
    }
    const { resetConfigCache } = await import("./config.js");
    resetConfigCache();
    delete process.env.NYXPAY_STORE_PATH;
    delete process.env.MERCHANT_KEK;
    delete process.env.NYXPAY_STRICT;
    delete process.env.NYXPAY_REQUIRE_PROOFS;
    vi.resetModules();
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  it("seals merchant secrets at rest (enc:v1:)", async () => {
    const { resetConfigCache } = await import("./config.js");
    resetConfigCache();
    const { loadStore } = await import("./services/store.js");
    const { enrollMerchant, findMerchant } = await import("./txAuth/registry.js");
    const { isSealed } = await import("./services/secretBox.js");
    const store = loadStore();
    enrollMerchant(store, { merchant_identifier: "secure.example", display_name: "Secure Co" });
    const m = findMerchant(store, "secure.example")!;
    expect(isSealed(m.merchant_secret)).toBe(true);
  });

  it("rejects structural-only settle when NYXPAY_REQUIRE_PROOFS=1 and artifacts missing", async () => {
    process.env.NYXPAY_REQUIRE_PROOFS = "1";
    const { resetConfigCache } = await import("./config.js");
    resetConfigCache();

    vi.doMock("./services/compactLedger.js", () => ({
      MANAGED_DIR: "/tmp/none",
      artifactsPresent: () => false,
      listCircuitArtifacts: () => [],
      runCompactCircuit: async () => {
        throw new Error("unreachable");
      },
      runPolicyUpdate: async () => {
        throw new Error("unreachable");
      },
      syncKycRoot: async () => {
        throw new Error("unreachable");
      },
    }));

    const { attestAndExecutePayment } = await import("./services/proofServer.js");
    const out = await attestAndExecutePayment({
      kycRoot: "aa".repeat(32),
      leaf: "bb".repeat(32),
      contactCommitment: "cc".repeat(32),
      oldBalanceCommitment: "dd".repeat(32),
      newBalanceCommitment: "ee".repeat(32),
      oldPolicyCommitment: "ff".repeat(32),
      newPolicyCommitment: "11".repeat(32),
      recipientProofDigest: "22".repeat(32),
      amountHint: 10n,
    });
    expect(out.ok).toBe(false);
    expect(out.grade).toBe("rejected");
  });

  it("loadConfig enables strict fail-closed flags under NYXPAY_STRICT", async () => {
    process.env.NYXPAY_STRICT = "1";
    process.env.NYXPAY_ALLOW_EPHEMERAL_KEK = "1";
    const { resetConfigCache, loadConfig } = await import("./config.js");
    resetConfigCache();
    const cfg = loadConfig();
    expect(cfg.isStrict).toBe(true);
    expect(cfg.requireProofs).toBe(true);
    expect(cfg.bindHost).toBe("127.0.0.1");
  });

  it("assertProductionBoot throws when secrets missing outside VITEST soft path", async () => {
    process.env.NYXPAY_STRICT = "1";
    delete process.env.MERCHANT_KEK;
    delete process.env.COMPACT_LOCAL_SK;
    delete process.env.NYXPAY_ALLOW_EPHEMERAL_KEK;
    delete process.env.NYXPAY_BOOT_SOFT;
    const vitest = process.env.VITEST;
    delete process.env.VITEST;
    const { resetConfigCache, assertProductionBoot } = await import("./config.js");
    resetConfigCache();
    expect(() => assertProductionBoot()).toThrow(/Strict boot refused/);
    if (vitest !== undefined) process.env.VITEST = vitest;
    else delete process.env.VITEST;
  });

  it("client makeProof does not self-attest verified:true", async () => {
    const { makeProof } = await import("../src/lib/crypto.js");
    const p = await makeProof("prove_spend_update", { recipient_proof_digest: "x" }, "digest");
    expect(p.verified).toBe(false);
    expect(p.grade).toBe("client_intent_binding");
    expect(p.protocol).toBe("circled-intent-binding/1");
  });
});
