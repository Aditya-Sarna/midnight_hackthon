import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

describe("zkProve — honest SNARK path", () => {
  it("proveCircuit returns digest when proof-server yields ≥32-byte proof", async () => {
    vi.resetModules();
    vi.doMock("./services/midnight.js", () => ({
      requireMidnight: () => ({ proofServer: "http://127.0.0.1:6300" }),
    }));
    vi.doMock("./services/compactLedger.js", () => ({
      MANAGED_DIR: "/tmp/managed",
    }));
    vi.doMock("@midnight-ntwrk/midnight-js-node-zk-config-provider", () => ({
      NodeZkConfigProvider: class {
        async getZKIR() {}
        async getProverKey() {}
        async getVerifierKey() {}
      },
    }));
    vi.doMock("@midnight-ntwrk/midnight-js-http-client-proof-provider", () => ({
      httpClientProvingProvider: () => ({
        check: async () => [],
        prove: async () => new Uint8Array(64).fill(7),
      }),
    }));
    vi.doMock("@midnight-ntwrk/compact-runtime", () => ({
      proofDataIntoSerializedPreimage: () => new Uint8Array([1, 2, 3]),
    }));

    const { proveCircuit } = await import("./services/zkProve.js");
    const out = await proveCircuit("prove_spend_update", {
      input: {} as never,
      output: {} as never,
      publicTranscript: [],
      privateTranscriptOutputs: [],
    });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.bytes).toBe(64);
    expect(out.proofDigest).toHaveLength(64);
  });

  it("proveCircuitBatch fails closed when any circuit prove fails", async () => {
    vi.resetModules();
    vi.doMock("./services/midnight.js", () => ({
      requireMidnight: () => ({ proofServer: "http://127.0.0.1:6300" }),
    }));
    vi.doMock("./services/compactLedger.js", () => ({ MANAGED_DIR: "/tmp/managed" }));
    vi.doMock("@midnight-ntwrk/midnight-js-node-zk-config-provider", () => ({
      NodeZkConfigProvider: class {
        async getZKIR() {}
        async getProverKey() {}
      },
    }));
    vi.doMock("@midnight-ntwrk/midnight-js-http-client-proof-provider", () => ({
      httpClientProvingProvider: () => ({
        check: async () => [],
        prove: async (_preimage: unknown, circuitId: string) => {
          if (circuitId === "prove_spend_update") throw new Error("boom");
          return new Uint8Array(64);
        },
      }),
    }));
    vi.doMock("@midnight-ntwrk/compact-runtime", () => ({
      proofDataIntoSerializedPreimage: () => new Uint8Array([1]),
    }));

    const { proveCircuitBatch } = await import("./services/zkProve.js");
    const dummy = {
      input: {} as never,
      output: {} as never,
      publicTranscript: [],
      privateTranscriptOutputs: [],
    };
    const out = await proveCircuitBatch([
      { circuit: "prove_recipient_valid", proofData: dummy },
      { circuit: "prove_spend_update", proofData: dummy },
    ]);
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.partial).toHaveLength(1);
    expect(out.reason).toMatch(/boom/);
  });
});

describe("zkProve live (proof-server)", () => {
  it("produces a real SNARK for prove_spend_update when proof-server is up", async () => {
    vi.resetModules();
    vi.doUnmock("./services/compactLedger.js");
    vi.doUnmock("./services/zkProve.js");
    vi.doUnmock("./services/midnight.js");
    vi.doUnmock("@midnight-ntwrk/midnight-js-node-zk-config-provider");
    vi.doUnmock("@midnight-ntwrk/midnight-js-http-client-proof-provider");
    vi.doUnmock("@midnight-ntwrk/compact-runtime");

    let healthy = false;
    try {
      const res = await fetch("http://127.0.0.1:6300/health", {
        signal: AbortSignal.timeout(2000),
      });
      healthy = res.ok;
    } catch {
      healthy = false;
    }
    if (!healthy) {
      console.warn("[skip] proof-server not healthy on :6300");
      return;
    }

    const {
      artifactsPresent,
      runCompactCircuit,
      syncKycRoot,
      resetCompactLedger,
      setSpendWitness,
    } = await import("./services/compactLedger.js");
    if (!artifactsPresent()) {
      console.warn("[skip] compact artifacts missing");
      return;
    }

    resetCompactLedger();
    const {
      compactBalanceCommit,
      randomOpening,
    } = await import("./services/compactCommit.js");
    const leaf = createHash("sha256").update(`live-leaf-${Date.now()}`).digest("hex");
    const root = createHash("sha256").update(`live-kyc-root-${Date.now()}`).digest("hex");
    await syncKycRoot(root, leaf);
    const oldOpen = randomOpening();
    const newOpen = randomOpening();
    const oldBal = 1000n;
    const amount = 25n;
    setSpendWitness({
      oldBalance: oldBal,
      amount,
      oldOpening: oldOpen,
      newOpening: newOpen,
    });
    const spend = await runCompactCircuit("prove_spend_update", [
      compactBalanceCommit(oldBal, oldOpen),
      compactBalanceCommit(oldBal - amount, newOpen),
      createHash("sha256").update(`recv-digest-${Date.now()}`).digest("hex"),
    ]);

    const { proveCircuit } = await import("./services/zkProve.js");
    const proved = await proveCircuit("prove_spend_update", spend.proofData);
    expect(proved.ok).toBe(true);
    if (!proved.ok) {
      console.error(proved.reason);
      return;
    }
    expect(proved.bytes).toBeGreaterThanOrEqual(32);
    expect(proved.proofDigest).toMatch(/^[a-f0-9]{64}$/);
  }, 300_000);
});
