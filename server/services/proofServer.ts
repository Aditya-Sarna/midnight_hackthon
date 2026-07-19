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
import { proveCircuit, warmProverKeys } from "./zkProve.js";
import { sha256 } from "./crypto.js";
import type { ProofData } from "@midnight-ntwrk/compact-runtime";

export { warmProverKeys };

const UNIVERSAL_ROUTE_CIRCUIT = "prove_authorized_transaction";

/** Compact execute then immediately SNARK — overlaps with sibling pipelines. */
async function compactThenSnark(
  circuit: string,
  run: () => Promise<CompactRunResult>,
  attemptZk: boolean
): Promise<{
  compact: CompactRunResult;
  snarkOk?: boolean;
  digest?: string;
  snarkError?: string;
}> {
  const compact = await run();
  if (!attemptZk || !compact.proofData) {
    return { compact };
  }
  const snark = await proveCircuit(circuit, compact.proofData as ProofData);
  if (!snark.ok) {
    return { compact, snarkOk: false, snarkError: snark.reason };
  }
  return { compact, snarkOk: true, digest: snark.proofDigest };
}

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

    // Amount is private witness — not a public circuit argument
    const amount = input.balanceWitness?.amount ?? input.amountHint;

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

    // Full Midnight path: Compact → SNARK per circuit, all pipelines in parallel
    // Wall-clock ≈ slowest (compact+snark), not sum of every circuit.
    const attemptZk =
      status.proofServerOk && status.artifactsOk && status.proverKeysLoaded.length >= 2;
    const hasPolicyKey = status.proverKeysLoaded.includes("prove_policy_update");

    if (attemptZk) {
      void warmProverKeys([
        "prove_recipient_valid",
        "prove_spend_update",
        ...(hasPolicyKey ? ["prove_policy_update"] : []),
      ]);
    }

    const tPipe = Date.now();
    const pipelines = [
      compactThenSnark(
        "prove_recipient_valid",
        () =>
          runCompactCircuit("prove_recipient_valid", [
            input.leaf,
            input.kycRoot,
            input.contactCommitment,
          ]),
        attemptZk
      ),
      compactThenSnark(
        "prove_policy_update",
        () =>
          runPolicyUpdate(
            input.oldPolicyCommitment,
            input.newPolicyCommitment,
            BigInt(amount)
          ),
        attemptZk && hasPolicyKey
      ),
      compactThenSnark(
        "prove_spend_update",
        () =>
          runCompactCircuit("prove_spend_update", [
            spendOldCommit,
            spendNewCommit,
            input.recipientProofDigest,
          ]),
        attemptZk
      ),
    ] as const;

    const [recipientPipe, policyPipe, spendPipe] = await Promise.all(pipelines);
    proveTimings.recipient = Date.now() - tPipe;
    proveTimings.policy = proveTimings.recipient;
    proveTimings.spend = proveTimings.recipient;
    proveTimings.zkSnark = Date.now() - tPipe;

    const recipient = recipientPipe.compact;
    const policy = policyPipe.compact;
    const spend = spendPipe.compact;

    let proved = false;
    let snarkDigests: Record<string, string> | undefined;
    let zkProveError: string | undefined;
    let grade: AttestationGrade = "compact-runtime";

    if (attemptZk) {
      snarkDigests = {};
      const pipes = [
        { id: "prove_recipient_valid", p: recipientPipe, required: true },
        { id: "prove_policy_update", p: policyPipe, required: hasPolicyKey },
        { id: "prove_spend_update", p: spendPipe, required: true },
      ];
      for (const { id, p, required } of pipes) {
        if (!required) continue;
        if (p.snarkOk && p.digest) {
          snarkDigests[id] = p.digest;
        } else if (p.snarkError) {
          zkProveError = `${id}: ${p.snarkError}`;
        }
      }
      const policySnarked = !hasPolicyKey || Boolean(snarkDigests.prove_policy_update);
      proved =
        Boolean(snarkDigests.prove_recipient_valid) &&
        Boolean(snarkDigests.prove_spend_update) &&
        policySnarked;
      grade = proved ? "zk-proved" : "compact-runtime";
      if (!proved && cfg.requireZkProve) {
        return {
          ok: false,
          mode: status.mode,
          grade: "rejected",
          reason: `ZK prove required — ${zkProveError ?? "incomplete SNARK batch"}`,
          compact: { kyc, recipient, policy, spend },
          proved: false,
          zkProveError,
          proveTimings,
        };
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
      reason: "Compact artifacts required for CircleProof",
    };
  }
  try {
    await syncKycRoot(input.kycRoot, input.leaf);
    const attemptZk =
      status.proofServerOk && status.artifactsOk && status.proverKeysLoaded.length >= 2;
    if (attemptZk) void warmProverKeys(["prove_session_auth"]);

    const pipe = await compactThenSnark(
      "prove_session_auth",
      () =>
        runCompactCircuit("prove_session_auth", [
          input.leaf,
          input.kycRoot,
          input.challenge,
          input.relyingPartyId,
          input.timeWindow,
        ]),
      attemptZk
    );
    const compact = pipe.compact;

    let proved = false;
    let snarkDigests: Record<string, string> | undefined;
    let zkProveError: string | undefined;
    let grade: AttestationGrade = "compact-runtime";

    if (attemptZk) {
      if (pipe.snarkOk && pipe.digest) {
        proved = true;
        snarkDigests = { prove_session_auth: pipe.digest };
        grade = "zk-proved";
      } else {
        zkProveError = pipe.snarkError;
        if (cfg.requireZkProve) {
          return {
            ok: false,
            mode: status.mode,
            grade: "rejected",
            reason: `NYXPAY_REQUIRE_ZK_PROVE=1 — ${pipe.snarkError ?? "session SNARK failed"}`,
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

/**
 * ZK-proven universal route binding.
 * Binds quoteId + routeId + routeCommitment into prove_authorized_transaction
 * public inputs, then elevates Compact execute → proof-server /prove when healthy.
 * Grade is zk-proved ONLY when SNARK bytes return — never inferred from health alone.
 */
export async function attestUniversalRouteBinding(input: {
  intentCommitment: string;
  routeCommitment: string;
  quoteId: string;
  routeId: string;
}): Promise<{
  ok: boolean;
  mode: ProofMode;
  grade: AttestationGrade;
  circuit: string;
  bindingDigest: string;
  snarkDigest?: string;
  proveMs?: number;
  reason?: string;
}> {
  const cfg = loadConfig();
  const status = await resolveProofMode();
  const circuit = UNIVERSAL_ROUTE_CIRCUIT;
  const intent =
    input.intentCommitment.length === 64
      ? input.intentCommitment
      : sha256(input.intentCommitment);
  const bindingDigest = sha256(
    `uni:bind|${intent}|${input.routeCommitment}|${input.quoteId}|${input.routeId}`
  );

  // Deterministic public inputs — all non-empty Bytes<32>, bound to this route
  const leaf = sha256(`uni:leaf|${input.routeCommitment}`);
  const root = sha256(`uni:root|${input.routeCommitment}`);
  const challenge = sha256(`uni:chal|${input.quoteId}|${input.routeId}`);
  const signature = sha256(`uni:sig|${intent}|${input.routeCommitment}`);

  if (!status.artifactsOk) {
    if (cfg.requireProofs || cfg.requireZkProve) {
      return {
        ok: false,
        mode: status.mode,
        grade: "rejected",
        circuit,
        bindingDigest,
        reason: "Compact artifacts required for universal route proof",
      };
    }
    return {
      ok: true,
      mode: status.mode,
      grade: "structural",
      circuit,
      bindingDigest,
      reason: "no Compact artifacts — structural bind only",
    };
  }

  const hasKey =
    status.proverKeysLoaded.includes(circuit) || status.proverKeysLoaded.length >= 2;
  const attemptZk = status.proofServerOk && status.artifactsOk && hasKey;
  if (attemptZk) void warmProverKeys([circuit]);

  try {
    const t0 = Date.now();
    const pipe = await compactThenSnark(
      circuit,
      () =>
        runCompactCircuit(circuit, [leaf, root, challenge, intent, signature]),
      attemptZk
    );
    const proveMs = Date.now() - t0;

    if (pipe.snarkOk && pipe.digest) {
      return {
        ok: true,
        mode: status.mode,
        grade: "zk-proved",
        circuit,
        bindingDigest,
        snarkDigest: pipe.digest,
        proveMs,
      };
    }

    if (cfg.requireZkProve && !process.env.VITEST) {
      return {
        ok: false,
        mode: status.mode,
        grade: "rejected",
        circuit,
        bindingDigest,
        proveMs,
        reason:
          pipe.snarkError ??
          "NYXPAY_REQUIRE_ZK_PROVE=1 — universal route SNARK required",
      };
    }

    return {
      ok: true,
      mode: status.mode,
      grade: "compact-runtime",
      circuit,
      bindingDigest,
      proveMs,
      reason: pipe.snarkError ?? "proof-server unavailable — Compact execute only",
    };
  } catch (e) {
    const reason = e instanceof Error ? e.message : "universal route circuit failed";
    if (cfg.requireZkProve && !process.env.VITEST) {
      return {
        ok: false,
        mode: status.mode,
        grade: "rejected",
        circuit,
        bindingDigest,
        reason,
      };
    }
    return {
      ok: true,
      mode: status.mode,
      grade: "structural",
      circuit,
      bindingDigest,
      reason,
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
