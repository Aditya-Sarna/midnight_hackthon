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

type ProvingProvider = {
  check: (preimage: unknown, circuitId: string) => Promise<unknown>;
  prove: (preimage: unknown, circuitId: string) => Promise<Uint8Array>;
};

let cachedZk: NodeZkConfigProvider<string> | null = null;
let cachedProving: ProvingProvider | null = null;
let cachedProofServerUrl: string | null = null;
const warmedCircuits = new Set<string>();

function getProviders(): { zk: NodeZkConfigProvider<string>; proving: ProvingProvider } {
  const cfg = requireMidnight();
  if (!cachedZk || !cachedProving || cachedProofServerUrl !== cfg.proofServer) {
    cachedZk = new NodeZkConfigProvider(MANAGED_DIR);
    cachedProving = httpClientProvingProvider(cfg.proofServer, cachedZk, {
      timeout: 90_000,
    }) as ProvingProvider;
    cachedProofServerUrl = cfg.proofServer;
    warmedCircuits.clear();
  }
  return { zk: cachedZk, proving: cachedProving };
}

async function warmCircuit(circuitId: string): Promise<void> {
  if (warmedCircuits.has(circuitId)) return;
  const { zk } = getProviders();
  await zk.getZKIR(circuitId);
  await zk.getProverKey(circuitId);
  warmedCircuits.add(circuitId);
}

/** Prove a single Compact circuit run against the proof-server. */
export async function proveCircuit(
  circuitId: string,
  proofData: ProofData
): Promise<CircuitProveOk | CircuitProveFail> {
  try {
    const { proving } = getProviders();
    await warmCircuit(circuitId);

    const preimage = proofDataIntoSerializedPreimage(
      proofData.input,
      proofData.output,
      proofData.publicTranscript,
      proofData.privateTranscriptOutputs,
      circuitId
    );

    // Skip redundant /check round-trip — prove fails fast on bad preimage.
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

/** Prove multiple circuits in parallel (wall-clock ≈ slowest SNARK, not sum). */
export async function proveCircuitBatch(
  runs: Array<{ circuit: string; proofData: ProofData }>
): Promise<BatchProveResult> {
  // Warm keys once up front so parallel proves don't stampede disk
  await Promise.all(runs.map((r) => warmCircuit(r.circuit)));

  const results = await Promise.all(
    runs.map((r) => proveCircuit(r.circuit, r.proofData))
  );

  const proofs: CircuitProveOk[] = [];
  for (const out of results) {
    if (!out.ok) {
      return { ok: false, reason: `${out.circuit}: ${out.reason}`, partial: proofs };
    }
    proofs.push(out);
  }
  const digests: Record<string, string> = {};
  for (const p of proofs) digests[p.circuit] = p.proofDigest;
  return { ok: true, proofs, digests };
}

/** Prefetch prover keys / ZKIR so the first payment isn't cold. */
export async function warmProverKeys(
  circuits: string[] = [
    "prove_session_auth",
    "prove_recipient_valid",
    "prove_policy_update",
    "prove_spend_update",
  ]
): Promise<{ warmed: string[] }> {
  const warmed: string[] = [];
  await Promise.all(
    circuits.map(async (c) => {
      try {
        await warmCircuit(c);
        warmed.push(c);
      } catch {
        /* key may be absent */
      }
    })
  );
  return { warmed };
}

/** Test helper */
export function resetZkProveCache() {
  cachedZk = null;
  cachedProving = null;
  cachedProofServerUrl = null;
  warmedCircuits.clear();
}
