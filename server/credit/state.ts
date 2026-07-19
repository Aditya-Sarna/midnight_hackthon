import { openingToHex, randomOpening } from "../services/compactCommit.js";
import { randomNonce, sha256 } from "../services/crypto.js";
import type { Store } from "../services/store.js";
import { defaultCreditConfig, type CreditState } from "./types.js";

/** Testnet / product-rail seed so “borrow 1000” from the home widget can show deals. */
const PILOT_POOL_LIQUIDITY = 100_000;

function poolCommit(total: number, outstanding: number, nonce: string): string {
  return sha256(`pool:${total}:${outstanding}:${nonce}`);
}

function pilotSeedAmount(): number {
  // Keep unit tests deterministic (they set pool liquidity explicitly)
  if (process.env.VITEST) return 0;
  return PILOT_POOL_LIQUIDITY;
}

export function creditState(store: Store): CreditState {
  if (!store.circledCredit) {
    const seed = pilotSeedAmount();
    const poolNonce = randomNonce(16);
    const poolOpening = openingToHex(randomOpening());
    store.circledCredit = {
      poolCommitment: poolCommit(seed, 0, poolNonce),
      poolTotal: seed,
      poolOutstanding: 0,
      poolNonce,
      poolOpening,
      shares: [],
      loans: [],
      standing: {},
      spentInstallmentNullifiers: [],
      config: defaultCreditConfig(),
    };
  }
  if (!store.circledCredit.config) {
    store.circledCredit.config = defaultCreditConfig();
  }
  // Existing empty pools (pre-seed stores) — one-time pilot liquidity outside tests
  const s = store.circledCredit;
  const seed = pilotSeedAmount();
  if (
    seed > 0 &&
    s.poolTotal === 0 &&
    s.poolOutstanding === 0 &&
    (s.shares?.length ?? 0) === 0 &&
    (s.loans?.length ?? 0) === 0
  ) {
    s.poolTotal = seed;
    s.poolNonce = randomNonce(16);
    s.poolOpening = openingToHex(randomOpening());
    s.poolCommitment = poolCommit(s.poolTotal, s.poolOutstanding, s.poolNonce);
  }
  return store.circledCredit;
}
