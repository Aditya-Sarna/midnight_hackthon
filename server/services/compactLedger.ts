/**
 * Compact ledger — enterprise witnesses:
 * Merkle path (kyc_tree.findPathForLeaf) + spend/credit persistentCommit openings.
 * Replay persists witness bags so balance arithmetic restores correctly.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import {
  createCircuitContext,
  createConstructorContext,
  sampleContractAddress,
  type CircuitContext,
  type CircuitResults,
  type ProofData,
} from "@midnight-ntwrk/compact-runtime";
import { loadConfig } from "../config.js";
import { hexToOpening, openingToHex, randomOpening } from "./compactCommit.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "../..");
export const MANAGED_DIR = join(ROOT, "contracts/managed/nyxpay");
const STATE_PATH = join(ROOT, "data/compact-ledger.json");

type KycPath = {
  leaf: Uint8Array;
  path: Array<{ sibling: { field: bigint }; goes_left: boolean }>;
};

type WitnessBag = {
  spendOldBal: bigint;
  spendAmount: bigint;
  spendOldOpen: Uint8Array;
  spendNewOpen: Uint8Array;
  creditOldBal: bigint;
  creditAmount: bigint;
  creditOldOpen: Uint8Array;
  creditNewOpen: Uint8Array;
  policyAmount: bigint;
  // Circle Credit v1
  lockOldBal: bigint;
  lockCollateral: bigint;
  lockLoan: bigint;
  lockOldOpen: Uint8Array;
  lockNewOpen: Uint8Array;
  lockColOpen: Uint8Array;
  poolOldTotal: bigint;
  poolDeposit: bigint;
  poolOldOpen: Uint8Array;
  poolNewOpen: Uint8Array;
  poolLenderOld: bigint;
  poolLenderOldOpen: Uint8Array;
  poolLenderNewOpen: Uint8Array;
  repayInstallment: bigint;
  repayRemainingOld: bigint;
  repayRemainingNew: bigint;
  standingOnTime: bigint;
  standingDefaults: bigint;
  standingThr: bigint;
  standingMaxDef: bigint;
  standingThrOpen: Uint8Array;
  standingMaxDefOpen: Uint8Array;
  strategyWeight: bigint;
  strategyOpen: Uint8Array;
};

type WitnessSnap = {
  spendOldBal: string;
  spendAmount: string;
  spendOldOpen: string;
  spendNewOpen: string;
  creditOldBal: string;
  creditAmount: string;
  creditOldOpen: string;
  creditNewOpen: string;
  policyAmount?: string;
  lockOldBal?: string;
  lockCollateral?: string;
  lockLoan?: string;
  lockOldOpen?: string;
  lockNewOpen?: string;
  lockColOpen?: string;
  poolOldTotal?: string;
  poolDeposit?: string;
  poolOldOpen?: string;
  poolNewOpen?: string;
  poolLenderOld?: string;
  poolLenderOldOpen?: string;
  poolLenderNewOpen?: string;
  repayInstallment?: string;
  repayRemainingOld?: string;
  repayRemainingNew?: string;
  standingOnTime?: string;
  standingDefaults?: string;
  standingThr?: string;
  standingMaxDef?: string;
  standingThrOpen?: string;
  standingMaxDefOpen?: string;
  strategyWeight?: string;
  strategyOpen?: string;
};

const bag: WitnessBag = {
  spendOldBal: 1000n,
  spendAmount: 1n,
  spendOldOpen: randomOpening(),
  spendNewOpen: randomOpening(),
  creditOldBal: 0n,
  creditAmount: 1n,
  creditOldOpen: randomOpening(),
  creditNewOpen: randomOpening(),
  policyAmount: 1n,
  lockOldBal: 1000n,
  lockCollateral: 150n,
  lockLoan: 100n,
  lockOldOpen: randomOpening(),
  lockNewOpen: randomOpening(),
  lockColOpen: randomOpening(),
  poolOldTotal: 0n,
  poolDeposit: 1n,
  poolOldOpen: randomOpening(),
  poolNewOpen: randomOpening(),
  poolLenderOld: 1000n,
  poolLenderOldOpen: randomOpening(),
  poolLenderNewOpen: randomOpening(),
  repayInstallment: 1n,
  repayRemainingOld: 1n,
  repayRemainingNew: 0n,
  standingOnTime: 0n,
  standingDefaults: 0n,
  standingThr: 0n,
  standingMaxDef: 0n,
  standingThrOpen: randomOpening(),
  standingMaxDefOpen: randomOpening(),
  strategyWeight: 42n,
  strategyOpen: randomOpening(),
};

let pendingMembershipLeaf: Uint8Array | null = null;

function snapBag(): WitnessSnap {
  return {
    spendOldBal: bag.spendOldBal.toString(),
    spendAmount: bag.spendAmount.toString(),
    spendOldOpen: openingToHex(bag.spendOldOpen),
    spendNewOpen: openingToHex(bag.spendNewOpen),
    creditOldBal: bag.creditOldBal.toString(),
    creditAmount: bag.creditAmount.toString(),
    creditOldOpen: openingToHex(bag.creditOldOpen),
    creditNewOpen: openingToHex(bag.creditNewOpen),
    policyAmount: bag.policyAmount.toString(),
    lockOldBal: bag.lockOldBal.toString(),
    lockCollateral: bag.lockCollateral.toString(),
    lockLoan: bag.lockLoan.toString(),
    lockOldOpen: openingToHex(bag.lockOldOpen),
    lockNewOpen: openingToHex(bag.lockNewOpen),
    lockColOpen: openingToHex(bag.lockColOpen),
    poolOldTotal: bag.poolOldTotal.toString(),
    poolDeposit: bag.poolDeposit.toString(),
    poolOldOpen: openingToHex(bag.poolOldOpen),
    poolNewOpen: openingToHex(bag.poolNewOpen),
    poolLenderOld: bag.poolLenderOld.toString(),
    poolLenderOldOpen: openingToHex(bag.poolLenderOldOpen),
    poolLenderNewOpen: openingToHex(bag.poolLenderNewOpen),
    repayInstallment: bag.repayInstallment.toString(),
    repayRemainingOld: bag.repayRemainingOld.toString(),
    repayRemainingNew: bag.repayRemainingNew.toString(),
    standingOnTime: bag.standingOnTime.toString(),
    standingDefaults: bag.standingDefaults.toString(),
    standingThr: bag.standingThr.toString(),
    standingMaxDef: bag.standingMaxDef.toString(),
    standingThrOpen: openingToHex(bag.standingThrOpen),
    standingMaxDefOpen: openingToHex(bag.standingMaxDefOpen),
    strategyWeight: bag.strategyWeight.toString(),
    strategyOpen: openingToHex(bag.strategyOpen),
  };
}

function restoreBag(s?: WitnessSnap) {
  if (!s) return;
  bag.spendOldBal = BigInt(s.spendOldBal);
  bag.spendAmount = BigInt(s.spendAmount);
  bag.spendOldOpen = hexToOpening(s.spendOldOpen);
  bag.spendNewOpen = hexToOpening(s.spendNewOpen);
  bag.creditOldBal = BigInt(s.creditOldBal);
  bag.creditAmount = BigInt(s.creditAmount);
  bag.creditOldOpen = hexToOpening(s.creditOldOpen);
  bag.creditNewOpen = hexToOpening(s.creditNewOpen);
  if (s.policyAmount) bag.policyAmount = BigInt(s.policyAmount);
  if (s.lockOldBal != null) bag.lockOldBal = BigInt(s.lockOldBal);
  if (s.lockCollateral != null) bag.lockCollateral = BigInt(s.lockCollateral);
  if (s.lockLoan != null) bag.lockLoan = BigInt(s.lockLoan);
  if (s.lockOldOpen) bag.lockOldOpen = hexToOpening(s.lockOldOpen);
  if (s.lockNewOpen) bag.lockNewOpen = hexToOpening(s.lockNewOpen);
  if (s.lockColOpen) bag.lockColOpen = hexToOpening(s.lockColOpen);
  if (s.poolOldTotal != null) bag.poolOldTotal = BigInt(s.poolOldTotal);
  if (s.poolDeposit != null) bag.poolDeposit = BigInt(s.poolDeposit);
  if (s.poolOldOpen) bag.poolOldOpen = hexToOpening(s.poolOldOpen);
  if (s.poolNewOpen) bag.poolNewOpen = hexToOpening(s.poolNewOpen);
  if (s.poolLenderOld != null) bag.poolLenderOld = BigInt(s.poolLenderOld);
  if (s.poolLenderOldOpen) bag.poolLenderOldOpen = hexToOpening(s.poolLenderOldOpen);
  if (s.poolLenderNewOpen) bag.poolLenderNewOpen = hexToOpening(s.poolLenderNewOpen);
  if (s.repayInstallment != null) bag.repayInstallment = BigInt(s.repayInstallment);
  if (s.repayRemainingOld != null) bag.repayRemainingOld = BigInt(s.repayRemainingOld);
  if (s.repayRemainingNew != null) bag.repayRemainingNew = BigInt(s.repayRemainingNew);
  if (s.standingOnTime != null) bag.standingOnTime = BigInt(s.standingOnTime);
  if (s.standingDefaults != null) bag.standingDefaults = BigInt(s.standingDefaults);
  if (s.standingThr != null) bag.standingThr = BigInt(s.standingThr);
  if (s.standingMaxDef != null) bag.standingMaxDef = BigInt(s.standingMaxDef);
  if (s.standingThrOpen) bag.standingThrOpen = hexToOpening(s.standingThrOpen);
  if (s.standingMaxDefOpen) bag.standingMaxDefOpen = hexToOpening(s.standingMaxDefOpen);
  if (s.strategyWeight != null) bag.strategyWeight = BigInt(s.strategyWeight);
  if (s.strategyOpen) bag.strategyOpen = hexToOpening(s.strategyOpen);
}

export function setStrategyWitness(input: {
  weight: bigint | number;
  opening: Uint8Array | string;
}) {
  bag.strategyWeight = BigInt(input.weight);
  bag.strategyOpen =
    typeof input.opening === "string" ? hexToOpening(input.opening) : input.opening;
}

export function setSpendWitness(input: {
  oldBalance: bigint | number;
  amount: bigint | number;
  oldOpening: Uint8Array | string;
  newOpening: Uint8Array | string;
}) {
  bag.spendOldBal = BigInt(input.oldBalance);
  bag.spendAmount = BigInt(input.amount);
  bag.spendOldOpen =
    typeof input.oldOpening === "string" ? hexToOpening(input.oldOpening) : input.oldOpening;
  bag.spendNewOpen =
    typeof input.newOpening === "string" ? hexToOpening(input.newOpening) : input.newOpening;
}

export function setCreditWitness(input: {
  oldBalance: bigint | number;
  amount: bigint | number;
  oldOpening: Uint8Array | string;
  newOpening: Uint8Array | string;
}) {
  bag.creditOldBal = BigInt(input.oldBalance);
  bag.creditAmount = BigInt(input.amount);
  bag.creditOldOpen =
    typeof input.oldOpening === "string" ? hexToOpening(input.oldOpening) : input.oldOpening;
  bag.creditNewOpen =
    typeof input.newOpening === "string" ? hexToOpening(input.newOpening) : input.newOpening;
}

export function setPolicyWitness(amount: bigint | number) {
  bag.policyAmount = BigInt(amount);
}

export function setCollateralLockWitness(input: {
  oldBalance: bigint | number;
  collateral: bigint | number;
  loan: bigint | number;
  oldOpening: Uint8Array | string;
  newOpening: Uint8Array | string;
  collateralOpening: Uint8Array | string;
}) {
  bag.lockOldBal = BigInt(input.oldBalance);
  bag.lockCollateral = BigInt(input.collateral);
  bag.lockLoan = BigInt(input.loan);
  bag.lockOldOpen =
    typeof input.oldOpening === "string" ? hexToOpening(input.oldOpening) : input.oldOpening;
  bag.lockNewOpen =
    typeof input.newOpening === "string" ? hexToOpening(input.newOpening) : input.newOpening;
  bag.lockColOpen =
    typeof input.collateralOpening === "string"
      ? hexToOpening(input.collateralOpening)
      : input.collateralOpening;
}

export function setPoolDepositWitness(input: {
  poolOldTotal: bigint | number;
  deposit: bigint | number;
  poolOldOpening: Uint8Array | string;
  poolNewOpening: Uint8Array | string;
  lenderOldBalance: bigint | number;
  lenderOldOpening: Uint8Array | string;
  lenderNewOpening: Uint8Array | string;
}) {
  bag.poolOldTotal = BigInt(input.poolOldTotal);
  bag.poolDeposit = BigInt(input.deposit);
  bag.poolOldOpen =
    typeof input.poolOldOpening === "string"
      ? hexToOpening(input.poolOldOpening)
      : input.poolOldOpening;
  bag.poolNewOpen =
    typeof input.poolNewOpening === "string"
      ? hexToOpening(input.poolNewOpening)
      : input.poolNewOpening;
  bag.poolLenderOld = BigInt(input.lenderOldBalance);
  bag.poolLenderOldOpen =
    typeof input.lenderOldOpening === "string"
      ? hexToOpening(input.lenderOldOpening)
      : input.lenderOldOpening;
  bag.poolLenderNewOpen =
    typeof input.lenderNewOpening === "string"
      ? hexToOpening(input.lenderNewOpening)
      : input.lenderNewOpening;
}

export function setRepayWitness(input: {
  installment: bigint | number;
  remainingOld: bigint | number;
  remainingNew: bigint | number;
}) {
  bag.repayInstallment = BigInt(input.installment);
  bag.repayRemainingOld = BigInt(input.remainingOld);
  bag.repayRemainingNew = BigInt(input.remainingNew);
}

export function setStandingWitness(input: {
  onTimeCount: bigint | number;
  defaultCount: bigint | number;
  onTimeThreshold: bigint | number;
  maxDefaults: bigint | number;
  thrOpening: Uint8Array | string;
  maxDefOpening: Uint8Array | string;
}) {
  bag.standingOnTime = BigInt(input.onTimeCount);
  bag.standingDefaults = BigInt(input.defaultCount);
  bag.standingThr = BigInt(input.onTimeThreshold);
  bag.standingMaxDef = BigInt(input.maxDefaults);
  bag.standingThrOpen =
    typeof input.thrOpening === "string" ? hexToOpening(input.thrOpening) : input.thrOpening;
  bag.standingMaxDefOpen =
    typeof input.maxDefOpening === "string"
      ? hexToOpening(input.maxDefOpening)
      : input.maxDefOpening;
}

type NyxContractModule = {
  Contract: new (w: Record<string, unknown>) => {
    initialState: (ctx: unknown) => {
      currentContractState: unknown;
      currentPrivateState: unknown;
      currentZswapLocalState: unknown;
    };
    impureCircuits: Record<string, (...a: never[]) => CircuitResults>;
  };
  ledger: (state: unknown) => {
    kyc_registry_root: Uint8Array;
    kyc_tree: {
      findPathForLeaf(leaf: Uint8Array): KycPath | undefined;
    };
    spent_nullifier_count: bigint;
    transfer_count: bigint;
    spent_challenge_count: bigint;
    credit_count: bigint;
    settlement_anchor_count?: bigint;
  };
  pureCircuits: Record<string, (...a: never[]) => unknown>;
};

let mod: NyxContractModule | null = null;
let contract: InstanceType<NyxContractModule["Contract"]> | null = null;
let circuitCtx: CircuitContext | null = null;
const contractAddress = sampleContractAddress();

function localSecretKeyBytes(): Uint8Array {
  return new Uint8Array(loadConfig().compactLocalSk);
}

function buildWitnesses() {
  return {
    localSecretKey(ctx: { privateState: unknown }) {
      return [ctx.privateState, localSecretKeyBytes()];
    },
    kycMembershipPath(ctx: {
      privateState: unknown;
      ledger: { kyc_tree: { findPathForLeaf(l: Uint8Array): KycPath | undefined } };
    }) {
      if (!pendingMembershipLeaf) {
        throw new Error("kycMembershipPath: membership leaf not staged");
      }
      const path = ctx.ledger.kyc_tree.findPathForLeaf(pendingMembershipLeaf);
      if (!path) {
        throw new Error(
          "kycMembershipPath: leaf not in Compact kyc_tree — publish_kyc_leaf first"
        );
      }
      return [ctx.privateState, path];
    },
    spendOldBalance(ctx: { privateState: unknown }) {
      return [ctx.privateState, bag.spendOldBal];
    },
    spendAmount(ctx: { privateState: unknown }) {
      return [ctx.privateState, bag.spendAmount];
    },
    spendOldOpening(ctx: { privateState: unknown }) {
      return [ctx.privateState, bag.spendOldOpen];
    },
    spendNewOpening(ctx: { privateState: unknown }) {
      return [ctx.privateState, bag.spendNewOpen];
    },
    creditOldBalance(ctx: { privateState: unknown }) {
      return [ctx.privateState, bag.creditOldBal];
    },
    creditAmount(ctx: { privateState: unknown }) {
      return [ctx.privateState, bag.creditAmount];
    },
    creditOldOpening(ctx: { privateState: unknown }) {
      return [ctx.privateState, bag.creditOldOpen];
    },
    creditNewOpening(ctx: { privateState: unknown }) {
      return [ctx.privateState, bag.creditNewOpen];
    },
    policyAmount(ctx: { privateState: unknown }) {
      return [ctx.privateState, bag.policyAmount];
    },
    lockOldBalance(ctx: { privateState: unknown }) {
      return [ctx.privateState, bag.lockOldBal];
    },
    lockCollateralAmount(ctx: { privateState: unknown }) {
      return [ctx.privateState, bag.lockCollateral];
    },
    lockLoanAmount(ctx: { privateState: unknown }) {
      return [ctx.privateState, bag.lockLoan];
    },
    lockOldOpening(ctx: { privateState: unknown }) {
      return [ctx.privateState, bag.lockOldOpen];
    },
    lockNewOpening(ctx: { privateState: unknown }) {
      return [ctx.privateState, bag.lockNewOpen];
    },
    lockCollateralOpening(ctx: { privateState: unknown }) {
      return [ctx.privateState, bag.lockColOpen];
    },
    poolOldTotal(ctx: { privateState: unknown }) {
      return [ctx.privateState, bag.poolOldTotal];
    },
    poolDepositAmount(ctx: { privateState: unknown }) {
      return [ctx.privateState, bag.poolDeposit];
    },
    poolOldOpening(ctx: { privateState: unknown }) {
      return [ctx.privateState, bag.poolOldOpen];
    },
    poolNewOpening(ctx: { privateState: unknown }) {
      return [ctx.privateState, bag.poolNewOpen];
    },
    poolLenderOldBalance(ctx: { privateState: unknown }) {
      return [ctx.privateState, bag.poolLenderOld];
    },
    poolLenderOldOpening(ctx: { privateState: unknown }) {
      return [ctx.privateState, bag.poolLenderOldOpen];
    },
    poolLenderNewOpening(ctx: { privateState: unknown }) {
      return [ctx.privateState, bag.poolLenderNewOpen];
    },
    repayInstallmentAmount(ctx: { privateState: unknown }) {
      return [ctx.privateState, bag.repayInstallment];
    },
    repayRemainingOld(ctx: { privateState: unknown }) {
      return [ctx.privateState, bag.repayRemainingOld];
    },
    repayRemainingNew(ctx: { privateState: unknown }) {
      return [ctx.privateState, bag.repayRemainingNew];
    },
    standingOnTimeCount(ctx: { privateState: unknown }) {
      return [ctx.privateState, bag.standingOnTime];
    },
    standingDefaultCount(ctx: { privateState: unknown }) {
      return [ctx.privateState, bag.standingDefaults];
    },
    standingOnTimeThreshold(ctx: { privateState: unknown }) {
      return [ctx.privateState, bag.standingThr];
    },
    standingMaxDefaults(ctx: { privateState: unknown }) {
      return [ctx.privateState, bag.standingMaxDef];
    },
    standingThrOpening(ctx: { privateState: unknown }) {
      return [ctx.privateState, bag.standingThrOpen];
    },
    standingMaxDefOpening(ctx: { privateState: unknown }) {
      return [ctx.privateState, bag.standingMaxDefOpen];
    },
    strategyWeight(ctx: { privateState: unknown }) {
      return [ctx.privateState, bag.strategyWeight];
    },
    strategyOpening(ctx: { privateState: unknown }) {
      return [ctx.privateState, bag.strategyOpen];
    },
  };
}

export function artifactsPresent(): boolean {
  return (
    existsSync(join(MANAGED_DIR, "keys/prove_spend_update.prover")) &&
    existsSync(join(MANAGED_DIR, "keys/prove_spend_update.verifier")) &&
    existsSync(join(MANAGED_DIR, "zkir/prove_spend_update.bzkir")) &&
    existsSync(join(MANAGED_DIR, "contract/index.js"))
  );
}

/** Circle Credit v1 circuits — only call Compact when these keys exist */
export function creditArtifactsPresent(): boolean {
  return (
    artifactsPresent() &&
    existsSync(join(MANAGED_DIR, "keys/prove_collateral_lock.prover")) &&
    existsSync(join(MANAGED_DIR, "keys/prove_pool_deposit.prover")) &&
    existsSync(join(MANAGED_DIR, "keys/prove_loan_repayment.prover")) &&
    existsSync(join(MANAGED_DIR, "keys/prove_credit_standing.prover"))
  );
}

export function listCircuitArtifacts(): string[] {
  if (!existsSync(join(MANAGED_DIR, "keys"))) return [];
  const info = JSON.parse(
    readFileSync(join(MANAGED_DIR, "compiler/contract-info.json"), "utf8")
  ) as { circuits: { name: string }[] };
  return info.circuits.map((c) => c.name);
}

async function loadModule(): Promise<NyxContractModule> {
  if (mod) return mod;
  if (!artifactsPresent()) {
    throw new Error("Compact artifacts missing — run: npm run compact:compile");
  }
  mod = (await import(pathToFileURL(join(MANAGED_DIR, "contract/index.js")).href)) as NyxContractModule;
  return mod;
}

function hexToBytes32(hex: string): Uint8Array {
  const clean = hex.replace(/^0x/, "").toLowerCase();
  const out = new Uint8Array(32);
  if (/^[0-9a-f]+$/.test(clean) && clean.length === 64) {
    for (let i = 0; i < 32; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
    return out;
  }
  return createHash("sha256").update(hex).digest();
}

function bytesToHex(b: Uint8Array): string {
  return Buffer.from(b).toString("hex");
}

type Persisted = {
  coinPublicKey: string;
  replay: Array<{ circuit: string; args: string[]; witnesses?: WitnessSnap }>;
  insertedLeaves: string[];
};

function emptyPersisted(): Persisted {
  return {
    coinPublicKey: "0000000000000000000000000000000000000000000000000000000000000001",
    replay: [],
    insertedLeaves: [],
  };
}

const WITNESS_CIRCUITS = new Set([
  "prove_spend_update",
  "prove_credit_update",
  "prove_policy_update",
  "prove_collateral_lock",
  "prove_pool_deposit",
  "prove_loan_repayment",
  "prove_credit_standing",
  "prove_pool_solvency",
  "prove_strategy_commitment",
]);

function loadPersisted(): Persisted {
  if (!existsSync(STATE_PATH)) return emptyPersisted();
  try {
    const raw = JSON.parse(readFileSync(STATE_PATH, "utf8")) as Persisted;
    const replay = raw.replay ?? [];
    // Drop pre-enterprise replay that cannot restore balance openings
    const incompatible = replay.some(
      (s) => WITNESS_CIRCUITS.has(s.circuit) && !s.witnesses
    );
    if (incompatible) {
      const fresh = emptyPersisted();
      savePersisted(fresh);
      return fresh;
    }
    return {
      ...emptyPersisted(),
      ...raw,
      insertedLeaves: raw.insertedLeaves ?? [],
      replay,
    };
  } catch {
    return emptyPersisted();
  }
}

function savePersisted(p: Persisted) {
  mkdirSync(dirname(STATE_PATH), { recursive: true });
  writeFileSync(STATE_PATH, JSON.stringify(p, null, 2));
}

function stageMembershipLeaf(circuit: string, args: Uint8Array[]) {
  if (
    circuit.includes("kyc") ||
    circuit === "prove_recipient_valid" ||
    circuit === "prove_session_auth" ||
    circuit === "publish_kyc_leaf"
  ) {
    pendingMembershipLeaf = args[0] ?? null;
  }
}

async function ensureContext(): Promise<{
  m: NyxContractModule;
  ctx: CircuitContext;
  c: InstanceType<NyxContractModule["Contract"]>;
}> {
  const m = await loadModule();
  if (!contract) {
    contract = new m.Contract(buildWitnesses());
  }
  if (circuitCtx) return { m, ctx: circuitCtx, c: contract };

  const persisted = loadPersisted();
  const ctor = createConstructorContext({}, persisted.coinPublicKey);
  const init = contract.initialState(ctor);
  let ctx = createCircuitContext(
    contractAddress,
    ctor.initialZswapLocalState,
    init.currentContractState,
    init.currentPrivateState
  );

  for (const step of persisted.replay) {
    restoreBag(step.witnesses);
    const args = step.args.map(hexToBytes32);
    stageMembershipLeaf(step.circuit, args);
    const fn = contract.impureCircuits[step.circuit];
    if (!fn) throw new Error(`Unknown Compact circuit in replay: ${step.circuit}`);
    const res = (fn as (c: CircuitContext, ...a: Uint8Array[]) => CircuitResults)(ctx, ...args);
    ctx = res.context;
  }

  circuitCtx = ctx;
  return { m, ctx, c: contract };
}

export type CompactRunResult = {
  ok: true;
  circuit: string;
  proofData: ProofData;
  ledger: {
    kycRegistryRoot: string;
    spentNullifierCount: string;
    transferCount: string;
    spentChallengeCount: string;
    creditCount?: string;
  };
};

/** Serialize Compact executes — shared circuitCtx / witness bag is not re-entrant. */
let compactChain: Promise<unknown> = Promise.resolve();
function withCompactLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = compactChain.then(fn, fn);
  compactChain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

export async function runCompactCircuit(
  circuit: string,
  argHex: string[]
): Promise<CompactRunResult> {
  return withCompactLock(async () => {
  // Caller sets bag witnesses before invoke; ensureContext replay can overwrite them.
  const staged = snapBag();
  const { m, ctx, c } = await ensureContext();
  restoreBag(staged);
  const args = argHex.map(hexToBytes32);
  stageMembershipLeaf(circuit, args);
  const fn = c.impureCircuits[circuit];
  if (!fn) throw new Error(`Unknown Compact circuit: ${circuit}`);
  const res = (fn as (c: CircuitContext, ...a: Uint8Array[]) => CircuitResults)(ctx, ...args);
  circuitCtx = res.context;

  const p = loadPersisted();
  p.replay.push({
    circuit,
    args: args.map(bytesToHex),
    witnesses: snapBag(),
  });
  if (circuit === "publish_kyc_leaf") {
    const leafHex = bytesToHex(args[0]!);
    if (!p.insertedLeaves.includes(leafHex)) p.insertedLeaves.push(leafHex);
  }
  savePersisted(p);

  const led = m.ledger(res.context.currentQueryContext.state);
  return {
    ok: true,
    circuit,
    proofData: res.proofData,
    ledger: {
      kycRegistryRoot: bytesToHex(led.kyc_registry_root),
      spentNullifierCount: led.spent_nullifier_count.toString(),
      transferCount: led.transfer_count.toString(),
      spentChallengeCount: led.spent_challenge_count.toString(),
      creditCount: led.credit_count?.toString(),
    },
  };
  });
}

export async function runPolicyUpdate(
  oldPolicy: string,
  newPolicy: string,
  amount: bigint
): Promise<CompactRunResult> {
  setPolicyWitness(amount);
  // Amount is private witness — only commitments are circuit arguments
  return runCompactCircuit("prove_policy_update", [oldPolicy, newPolicy]);
}

export async function runCollateralLock(args: {
  oldBalanceCommitment: string;
  newBalanceCommitment: string;
  collateralCommitment: string;
  loanCommitment: string;
  witness: Parameters<typeof setCollateralLockWitness>[0];
}): Promise<CompactRunResult> {
  setCollateralLockWitness(args.witness);
  return runCompactCircuit("prove_collateral_lock", [
    args.oldBalanceCommitment,
    args.newBalanceCommitment,
    args.collateralCommitment,
    args.loanCommitment,
  ]);
}

export async function runPoolDeposit(args: {
  oldPoolCommitment: string;
  newPoolCommitment: string;
  oldLenderBalanceCommitment: string;
  newLenderBalanceCommitment: string;
  witness: Parameters<typeof setPoolDepositWitness>[0];
}): Promise<CompactRunResult> {
  setPoolDepositWitness(args.witness);
  return runCompactCircuit("prove_pool_deposit", [
    args.oldPoolCommitment,
    args.newPoolCommitment,
    args.oldLenderBalanceCommitment,
    args.newLenderBalanceCommitment,
  ]);
}

export async function runLoanRepayment(args: {
  loanCommitmentOld: string;
  loanCommitmentNew: string;
  installmentNullifier: string;
  creditIdentity: string;
  witness: Parameters<typeof setRepayWitness>[0];
}): Promise<CompactRunResult> {
  setRepayWitness(args.witness);
  return runCompactCircuit("prove_loan_repayment", [
    args.loanCommitmentOld,
    args.loanCommitmentNew,
    args.installmentNullifier,
    args.creditIdentity,
  ]);
}

export async function runCreditStanding(args: {
  creditIdentity: string;
  onTimeThreshold: string;
  maxDefaultsAllowed: string;
  witness: Parameters<typeof setStandingWitness>[0];
}): Promise<CompactRunResult> {
  setStandingWitness(args.witness);
  return runCompactCircuit("prove_credit_standing", [
    args.creditIdentity,
    args.onTimeThreshold,
    args.maxDefaultsAllowed,
  ]);
}

export async function runStrategyCommitment(args: {
  strategyCommitment: string;
  strategyId: string;
  witness: Parameters<typeof setStrategyWitness>[0];
}): Promise<CompactRunResult> {
  setStrategyWitness(args.witness);
  return runCompactCircuit("prove_strategy_commitment", [
    args.strategyCommitment,
    args.strategyId,
  ]);
}

let lastSyncedRootHex: string | null = null;

/** Publish app root + ensure leaf is in Compact HistoricMerkleTree */
export async function syncKycRoot(rootHex: string, leafHex?: string): Promise<CompactRunResult> {
  const p = loadPersisted();
  const leafKey = leafHex ? bytesToHex(hexToBytes32(leafHex)) : null;
  const leafReady = !leafKey || p.insertedLeaves.includes(leafKey);

  // Skip re-publish when ledger already has this root + leaf (2nd+ pays were redoing KYC Compact)
  if (circuitCtx && lastSyncedRootHex === rootHex && leafReady) {
    const { m, ctx } = await ensureContext();
    const led = m.ledger(ctx.currentQueryContext.state);
    return {
      ok: true,
      circuit: "publish_kyc_root",
      proofData: {
        input: {} as never,
        output: {} as never,
        publicTranscript: [],
        privateTranscriptOutputs: [],
      },
      ledger: {
        kycRegistryRoot: bytesToHex(led.kyc_registry_root),
        spentNullifierCount: led.spent_nullifier_count.toString(),
        transferCount: led.transfer_count.toString(),
        spentChallengeCount: led.spent_challenge_count.toString(),
        creditCount: led.credit_count?.toString(),
      },
    };
  }

  const rootResult = await runCompactCircuit("publish_kyc_root", [rootHex]);
  lastSyncedRootHex = rootHex;
  if (leafHex && !leafReady) {
    return runCompactCircuit("publish_kyc_leaf", [leafHex]);
  }
  return rootResult;
}

export async function readCompactLedger() {
  if (!artifactsPresent()) {
    return { ready: false as const, reason: "artifacts missing" };
  }
  try {
    const { m, ctx } = await ensureContext();
    const led = m.ledger(ctx.currentQueryContext.state);
    return {
      ready: true as const,
      address: String(contractAddress),
      kycRegistryRoot: bytesToHex(led.kyc_registry_root),
      spentNullifierCount: led.spent_nullifier_count.toString(),
      transferCount: led.transfer_count.toString(),
      spentChallengeCount: led.spent_challenge_count.toString(),
      creditCount: led.credit_count?.toString(),
      replaySteps: loadPersisted().replay.length,
    };
  } catch (e) {
    return {
      ready: false as const,
      reason: e instanceof Error ? e.message : String(e),
    };
  }
}

export function resetCompactLedger() {
  circuitCtx = null;
  contract = null;
  mod = null;
  pendingMembershipLeaf = null;
  lastSyncedRootHex = null;
  savePersisted(emptyPersisted());
}
