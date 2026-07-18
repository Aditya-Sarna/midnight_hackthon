/**
 * Real circuit-level ZK prove via Midnight proof-server /prove.
 * Uses Compact proofData → serialized preimage → SNARK bytes.
 * This is the honest path for proved:true (not key warm-up).
 */
import { createHash } from "node:crypto";
import { proofDataIntoSerializedPreimage, type ProofData } from "@midnight-ntwrk/compact-runtime";
import { NodeZkConfigProvider } from "@midnight-ntwrk/midnight-js-node-zk-config-provider";
import { httpClientProvingProvider } from "@midnight-ntwrk/midnight-js-http-client-proof-provider";
import { MANAGED_DIR } from "./compactLedger.js";
import { requireMidnight } from "./midnight.js";

export type CircuitProveOk = {
  ok: true;
  circuit: string;
  proof: Uint8Array;
  proofDigest: string;
  bytes: number;
};

export type CircuitProveFail = {
  ok: false;
  circuit: string;
  reason: string;
};

export type BatchProveResult =
  | {
      ok: true;
      proofs: CircuitProveOk[];
      digests: Record<string, string>;
    }
  | {
      ok: false;
      reason: string;
      partial: CircuitProveOk[];
    };

function digest(proof: Uint8Array): string {
  return createHash("sha256").update(proof).digest("hex");
}

/** Prove a single Compact circuit run against the proof-server. */
export async function proveCircuit(
  circuitId: string,
  proofData: ProofData
): Promise<CircuitProveOk | CircuitProveFail> {
  try {
    const cfg = requireMidnight();
    const zk = new NodeZkConfigProvider(MANAGED_DIR);
    const proving = httpClientProvingProvider(cfg.proofServer, zk, { timeout: 300_000 });

    // Ensure keys resolve before prove
    await zk.getZKIR(circuitId);
    await zk.getProverKey(circuitId);

    const preimage = proofDataIntoSerializedPreimage(
      proofData.input,
      proofData.output,
      proofData.publicTranscript,
      proofData.privateTranscriptOutputs,
      circuitId
    );

    await proving.check(preimage, circuitId);
    const proof = await proving.prove(preimage, circuitId);
    if (!(proof instanceof Uint8Array) || proof.byteLength < 32) {
      return { ok: false, circuit: circuitId, reason: "Empty or invalid SNARK from proof-server" };
    }
    return {
      ok: true,
      circuit: circuitId,
      proof,
      proofDigest: digest(proof),
      bytes: proof.byteLength,
    };
  } catch (e) {
    return {
      ok: false,
      circuit: circuitId,
      reason: e instanceof Error ? e.message : String(e),
    };
  }
}

/** Prove multiple circuit runs; all-or-nothing for settlement-grade ZK. */
export async function proveCircuitBatch(
  runs: Array<{ circuit: string; proofData: ProofData }>
): Promise<BatchProveResult> {
  const proofs: CircuitProveOk[] = [];
  for (const r of runs) {
    const out = await proveCircuit(r.circuit, r.proofData);
    if (!out.ok) {
      return { ok: false, reason: `${out.circuit}: ${out.reason}`, partial: proofs };
    }
    proofs.push(out);
  }
  const digests: Record<string, string> = {};
  for (const p of proofs) digests[p.circuit] = p.proofDigest;
  return { ok: true, proofs, digests };
}
