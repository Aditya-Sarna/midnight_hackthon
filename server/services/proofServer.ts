/**
 * Midnight proof-server bridge + Compact artifact attestation.
 * Modes:
 *  - midnight-proof-server: Compact execute + real /prove SNARKs when healthy
 *  - compact-runtime: artifacts present, circuits execute via compact-runtime
 *  - compact-sim: structural only — rejected when NYXPAY_REQUIRE_PROOFS / strict
 *
 * proved:true ONLY after proof-server returns SNARK bytes via /prove.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { NodeZkConfigProvider } from "@midnight-ntwrk/midnight-js-node-zk-config-provider";
import { loadConfig } from "../config.js";
import { requireMidnight } from "./midnight.js";
import {
  MANAGED_DIR,
  artifactsPresent,
  listCircuitArtifacts,
  runCompactCircuit,
  runPolicyUpdate,
  setSpendWitness,
  syncKycRoot,
  type CompactRunResult,
} from "./compactLedger.js";
import {
  compactBalanceCommit,
  hexToOpening,
  randomOpening,
  openingToHex,
} from "./compactCommit.js";
import { proveCircuitBatch } from "./zkProve.js";

export type ProofMode = "midnight-proof-server" | "compact-runtime" | "compact-sim";

export type AttestationGrade =
  | "zk-proved" // real SNARK bytes from proof-server /prove
  | "compact-runtime" // circuits executed via compact-runtime
  | "structural" // client intent-binding only
  | "rejected";

export type ProofStackStatus = {
  mode: ProofMode;
  proofServerOk: boolean;
  artifactsOk: boolean;
  circuits: string[];
  detail: string;
  proverKeysLoaded: string[];
};

async function probeProofServer(): Promise<boolean> {
  const cfg = requireMidnight();
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2500);
    const res = await fetch(`${cfg.proofServer}/health`, { signal: ctrl.signal });
    clearTimeout(t);
    return res.ok;
  } catch {
    return false;
  }
}

async function loadProverKeyNames(): Promise<string[]> {
  if (!artifactsPresent()) return [];
  try {
    const zk = new NodeZkConfigProvider(MANAGED_DIR);
    const names = [
      "prove_spend_update",
      "prove_recipient_valid",
      "prove_session_auth",
      "publish_kyc_root",
      "prove_authorized_transaction",
      "prove_credit_update",
    ];
    const loaded: string[] = [];
    for (const n of names) {
      if (!existsSync(join(MANAGED_DIR, `keys/${n}.prover`))) continue;
      await zk.getProverKey(n);
      await zk.getVerifierKey(n);
      loaded.push(n);
    }
    return loaded;
  } catch {
    return [];
  }
}

export async function resolveProofMode(): Promise<ProofStackStatus> {
  const artifactsOk = artifactsPresent();
  const circuits = artifactsOk ? listCircuitArtifacts() : [];
  const proofServerOk = await probeProofServer();
  const proverKeysLoaded = artifactsOk ? await loadProverKeyNames() : [];

  if (artifactsOk && proofServerOk && proverKeysLoaded.length >= 3) {
    return {
      mode: "midnight-proof-server",
      proofServerOk,
      artifactsOk,
      circuits,
      proverKeysLoaded,
      detail:
        "compactc artifacts + proof-server healthy — Compact execute + real /prove SNARKs",
    };
  }
  if (artifactsOk && proverKeysLoaded.length >= 3) {
    return {
      mode: "compact-runtime",
      proofServerOk,
      artifactsOk,
      circuits,
      proverKeysLoaded,
      detail:
        "compactc artifacts loaded; circuits execute via compact-runtime. Start proof-server: npm run proof-server",
    };
  }
  return {
    mode: "compact-sim",
    proofServerOk,
    artifactsOk,
    circuits,
    proverKeysLoaded,
    detail: "Compact artifacts missing — run npm run compact:compile",
  };
}

export type SettleProofInput = {
  kycRoot: string;
  leaf: string;
  contactCommitment: string;
  oldBalanceCommitment: string;
  newBalanceCommitment: string;
  oldPolicyCommitment: string;
  newPolicyCommitment: string;
  recipientProofDigest: string;
  amountHint: bigint;
  /** Enterprise spend openings (persistentCommit witnesses) */
  balanceWitness?: {
    oldBalance: number | bigint;
    amount?: number | bigint;
    oldOpening: string;
    newOpening: string;
  };
  recipientProof?: { proof?: string; publicInputs?: Record<string, string>; circuit?: string };
  policyProof?: { proof?: string; publicInputs?: Record<string, string>; circuit?: string };
  spendProof?: { proof?: string; publicInputs?: Record<string, string>; circuit?: string };
};

/**
 * Execute Compact circuits, then produce real SNARKs when proof-server is available.
 */
export async function attestAndExecutePayment(input: SettleProofInput): Promise<{
  ok: boolean;
  mode: ProofMode;
  grade: AttestationGrade;
  reason?: string;
  compact?: {
    kyc?: CompactRunResult;
    recipient?: CompactRunResult;
    policy?: CompactRunResult;
    spend?: CompactRunResult;
  };
  proved?: boolean;
  snarkDigests?: Record<string, string>;
  zkProveError?: string;
  /** Wall-clock ms per Compact/ZK step — for ProofTheater live animation */
  proveTimings?: Record<string, number>;
}> {
  const cfg = loadConfig();
  const status = await resolveProofMode();
  const proveTimings: Record<string, number> = {};

  if (!status.artifactsOk) {
    if (cfg.requireProofs) {
      return {
        ok: false,
        mode: status.mode,
        grade: "rejected",
        reason: "Compact artifacts required (NYXPAY_REQUIRE_PROOFS) — run npm run compact:compile",
      };
    }
    const structural = structuralAttest(input);
    return {
      ok: structural.ok,
      mode: status.mode,
      grade: structural.ok ? "structural" : "rejected",
      reason: structural.reason,
      proved: false,
    };
  }

  try {
    const t0 = Date.now();
    const kyc = await syncKycRoot(input.kycRoot, input.leaf);
    proveTimings.kyc = Date.now() - t0;

    const t1 = Date.now();
    const recipient = await runCompactCircuit("prove_recipient_valid", [
      input.leaf,
      input.kycRoot,
      input.contactCommitment,
    ]);
    proveTimings.recipient = Date.now() - t1;

    // Amount is private witness — not a public circuit argument
    const amount = input.balanceWitness?.amount ?? input.amountHint;
    const t2 = Date.now();
    const policy = await runPolicyUpdate(
      input.oldPolicyCommitment,
      input.newPolicyCommitment,
      BigInt(amount)
    );
    proveTimings.policy = Date.now() - t2;

    // Enterprise balance arithmetic witnesses (persistentCommit)
    const oldBal = BigInt(input.balanceWitness?.oldBalance ?? 100_000);
    const oldOpen = input.balanceWitness?.oldOpening
      ? hexToOpening(input.balanceWitness.oldOpening)
      : randomOpening();
    const newOpen = input.balanceWitness?.newOpening
      ? hexToOpening(input.balanceWitness.newOpening)
      : randomOpening();
    if (oldBal < BigInt(amount)) {
      return {
        ok: false,
        mode: status.mode,
        grade: "rejected",
        reason: "insufficient balance for Compact spend arithmetic",
      };
    }
    setSpendWitness({
      oldBalance: oldBal,
      amount,
      oldOpening: oldOpen,
      newOpening: newOpen,
    });
    const spendOldCommit = compactBalanceCommit(oldBal, oldOpen);
    const spendNewCommit = compactBalanceCommit(oldBal - BigInt(amount), newOpen);
    void openingToHex;

    const t3 = Date.now();
    const spend = await runCompactCircuit("prove_spend_update", [
      spendOldCommit,
      spendNewCommit,
      input.recipientProofDigest,
    ]);
    proveTimings.spend = Date.now() - t3;

    let proved = false;
    let snarkDigests: Record<string, string> | undefined;
    let zkProveError: string | undefined;
    let grade: AttestationGrade = "compact-runtime";

    const hasPolicyKey = status.proverKeysLoaded.includes("prove_policy_update");
    const attemptZk =
      status.proofServerOk && status.artifactsOk && status.proverKeysLoaded.length >= 2;
    if (attemptZk) {
      const tZk = Date.now();
      const circuits: { circuit: string; proofData: typeof recipient.proofData }[] = [
        { circuit: "prove_recipient_valid", proofData: recipient.proofData },
        { circuit: "prove_spend_update", proofData: spend.proofData },
      ];
      // Full privacy claim: amount-private policy SNARK when keys exist
      if (hasPolicyKey && policy.proofData) {
        circuits.splice(1, 0, {
          circuit: "prove_policy_update",
          proofData: policy.proofData,
        });
      }
      const batch = await proveCircuitBatch(circuits);
      proveTimings.zkSnark = Date.now() - tZk;
      if (batch.ok) {
        const policySnarked = !hasPolicyKey || Boolean(batch.digests?.prove_policy_update);
        proved = policySnarked;
        snarkDigests = batch.digests;
        // Only call zk-proved when recipient+spend (+policy if keyed) all returned SNARKs
        grade = policySnarked ? "zk-proved" : "compact-runtime";
        if (hasPolicyKey && !batch.digests?.prove_policy_update) {
          zkProveError = "policy SNARK missing from batch";
        }
      } else {
        zkProveError = batch.reason;
        if (cfg.requireZkProve) {
          return {
            ok: false,
            mode: status.mode,
            grade: "rejected",
            reason: `ZK prove required — ${batch.reason}`,
            compact: { kyc, recipient, policy, spend },
            proved: false,
            zkProveError,
            proveTimings,
          };
        }
      }
    } else if (cfg.requireZkProve) {
      return {
        ok: false,
        mode: status.mode,
        grade: "rejected",
        reason: "ZK prove required — proof-server not available or keys incomplete",
        compact: { kyc, recipient, policy, spend },
        proved: false,
        proveTimings,
      };
    }

    return {
      ok: true,
      mode: status.mode,
      grade,
      compact: { kyc, recipient, policy, spend },
      proved,
      snarkDigests,
      zkProveError,
      proveTimings,
    };
  } catch (e) {
    return {
      ok: false,
      mode: status.mode,
      grade: "rejected",
      reason: e instanceof Error ? e.message : "Compact circuit failed",
      proveTimings,
    };
  }
}

export async function attestAndExecuteSessionAuth(input: {
  kycRoot: string;
  leaf: string;
  challenge: string;
  relyingPartyId: string;
  timeWindow: string;
}): Promise<{
  ok: boolean;
  mode: ProofMode;
  grade: AttestationGrade;
  reason?: string;
  compact?: CompactRunResult;
  proved?: boolean;
  snarkDigests?: Record<string, string>;
  zkProveError?: string;
}> {
  const cfg = loadConfig();
  const status = await resolveProofMode();
  if (!status.artifactsOk) {
    return {
      ok: false,
      mode: status.mode,
      grade: "rejected",
      reason: "Compact artifacts required for CircledProof",
    };
  }
  try {
    await syncKycRoot(input.kycRoot, input.leaf);
    const compact = await runCompactCircuit("prove_session_auth", [
      input.leaf,
      input.kycRoot,
      input.challenge,
      input.relyingPartyId,
      input.timeWindow,
    ]);

    let proved = false;
    let snarkDigests: Record<string, string> | undefined;
    let zkProveError: string | undefined;
    let grade: AttestationGrade = "compact-runtime";

    const attemptZk =
      status.proofServerOk && status.artifactsOk && status.proverKeysLoaded.length >= 2;
    if (attemptZk) {
      const batch = await proveCircuitBatch([
        { circuit: "prove_session_auth", proofData: compact.proofData },
      ]);
      if (batch.ok) {
        proved = true;
        snarkDigests = batch.digests;
        grade = "zk-proved";
      } else {
        zkProveError = batch.reason;
        if (cfg.requireZkProve) {
          return {
            ok: false,
            mode: status.mode,
            grade: "rejected",
            reason: `NYXPAY_REQUIRE_ZK_PROVE=1 — ${batch.reason}`,
            compact,
            proved: false,
            zkProveError,
          };
        }
      }
    } else if (cfg.requireZkProve) {
      return {
        ok: false,
        mode: status.mode,
        grade: "rejected",
        reason: "NYXPAY_REQUIRE_ZK_PROVE=1 — proof-server not available",
        compact,
        proved: false,
      };
    }

    return {
      ok: true,
      mode: status.mode,
      grade,
      compact,
      proved,
      snarkDigests,
      zkProveError,
    };
  } catch (e) {
    return {
      ok: false,
      mode: status.mode,
      grade: "rejected",
      reason: e instanceof Error ? e.message : "session auth circuit failed",
    };
  }
}

/** Kept for API compatibility — prefer attestAndExecutePayment */
export async function attestProofBundle(bundle: {
  recipientProof?: { proof?: string; publicInputs?: Record<string, string>; circuit?: string };
  policyProof?: { proof?: string; publicInputs?: Record<string, string>; circuit?: string };
  spendProof?: { proof?: string; publicInputs?: Record<string, string>; circuit?: string };
}): Promise<{ ok: boolean; mode: ProofMode; reason?: string }> {
  const status = await resolveProofMode();
  const structural = structuralAttest(bundle);
  if (status.artifactsOk) {
    return { ok: structural.ok, mode: status.mode, reason: structural.reason };
  }
  const cfg = loadConfig();
  if (cfg.requireProofs) {
    return {
      ok: false,
      mode: status.mode,
      reason: "Structural-only proofs rejected under NYXPAY_REQUIRE_PROOFS",
    };
  }
  return { ...structural, mode: status.mode };
}

function structuralAttest(bundle: {
  recipientProof?: { proof?: string; publicInputs?: Record<string, string>; circuit?: string };
  policyProof?: { proof?: string; publicInputs?: Record<string, string>; circuit?: string };
  spendProof?: { proof?: string; publicInputs?: Record<string, string>; circuit?: string };
}): { ok: boolean; reason?: string } {
  const proofs = [
    { proof: bundle.recipientProof, kind: "recipient" },
    { proof: bundle.policyProof, kind: "policy" },
    { proof: bundle.spendProof, kind: "spend" },
  ];
  for (const p of proofs) {
    if (!p.proof?.proof || p.proof.proof.length < 32) {
      return { ok: false, reason: "Incomplete proof bundle" };
    }
    if (!p.proof.circuit?.startsWith("prove_")) {
      return { ok: false, reason: "Unknown circuit" };
    }
    for (const [k, v] of Object.entries(p.proof.publicInputs ?? {})) {
      const key = k.toLowerCase();
      // Amount must never appear in public inputs — private witness only
      const okKey =
        /commitment|digest|root|nullifier|membership|bound|contract|template/.test(key);
      if (!okKey && /^(balance|amount|address|name|plaintext)/.test(key)) {
        return { ok: false, reason: `Private field leaked: ${k}` };
      }
    }
  }
  return { ok: true };
}
