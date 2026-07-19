/**
 * Circle Credit v1 — client helpers (Class 0 openings never leave the device).
 */
import { compactBalanceCommit, randomOpeningHex } from "./compactCommit";
import type { DeviceVaultState } from "./deviceVault";
import {
  alignBalanceCommitmentWithServer,
  applyCredit,
  applySpend,
  ensureCompactBalanceWitness,
  saveVault,
} from "./deviceVault";
import { defaultCollateralForLoan } from "./creditVoice";
async function post(path: string, body: unknown) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok || data.ok === false) {
    throw new Error(data.reason || data.error || "Credit request failed");
  }
  return data;
}

export async function fetchCreditStatus() {
  const res = await fetch("/api/skills/circled-credit/status");
  return res.json();
}

export async function fetchBorrowDisclosure(input: {
  loanAmount: number;
  collateralAmount: number;
  installments?: number;
}) {
  const q = new URLSearchParams({
    loanAmount: String(input.loanAmount),
    collateralAmount: String(input.collateralAmount),
  });
  if (input.installments != null) q.set("installments", String(input.installments));
  const res = await fetch(`/api/skills/circled-credit/disclosure?${q}`);
  return res.json();
}

/** Term packages shown after a borrow ask — Quick / Standard / Flex / Stretch */
export async function fetchBorrowDeals(input: {
  loanAmount: number;
  collateralAmount: number;
}) {
  const q = new URLSearchParams({
    loanAmount: String(input.loanAmount),
    collateralAmount: String(input.collateralAmount),
    deals: "1",
  });
  const res = await fetch(`/api/skills/circled-credit/disclosure?${q}`);
  return res.json();
}

export async function fetchCreditIdentity(userId: string) {
  return post("/api/skills/circled-credit/identity", { userId });
}

export async function fetchCreditLoans(userId: string) {
  const res = await fetch(`/api/skills/circled-credit/loans/${encodeURIComponent(userId)}`);
  return res.json();
}

/** Lender: deposit free balance into the pooled capital */
export async function creditPoolDeposit(vault: DeviceVaultState, amount: number) {
  if (!(amount > 0) || vault.balance < amount) {
    throw new Error("Insufficient balance for deposit");
  }
  const synced = await ensureCompactBalanceWitness(vault);
  const oldOpening = synced.balanceOpening!;
  const newOpening = randomOpeningHex();
  const newBal = synced.balance - amount;
  const oldBalanceCommitment = synced.balanceCommitment;
  const newBalanceCommitment = await compactBalanceCommit(newBal, newOpening);

  const data = await post("/api/skills/circled-credit/pool/deposit", {
    userId: synced.userId,
    amount,
    oldBalanceCommitment,
    newBalanceCommitment,
    balanceWitness: {
      oldBalance: synced.balance,
      amount,
      oldOpening,
      newOpening,
    },
  });

  const next = await applySpend(synced, amount, synced.policy.periodCounters, {
    balanceNonce: synced.balanceNonce,
    balanceOpening: newOpening,
    balanceCommitment: newBalanceCommitment,
    policyNonce: synced.policy.nonce,
    policyCommitment: synced.policy.commitment,
  });
  await saveVault(next);
  return { data, vault: next };
}

/**
 * Borrower: lock ≥150% collateral, draw loan from pool into free balance.
 * Net free-balance change = -collateral + loanAmount.
 */
export async function creditBorrow(
  vault: DeviceVaultState,
  input: { loanAmount: number; collateralAmount: number; installments?: number }
) {
  const loanAmount = Math.floor(Number(input.loanAmount));
  const collateralAmount = Math.floor(
    Number(input.collateralAmount) || defaultCollateralForLoan(loanAmount)
  );
  if (!(loanAmount > 0)) throw new Error("Enter a loan amount");
  if (2 * collateralAmount < 3 * loanAmount) {
    throw new Error(`Need ≥150% collateral (min ${defaultCollateralForLoan(loanAmount)})`);
  }
  if (vault.balance < collateralAmount) {
    throw new Error(
      `Need ${collateralAmount} free balance to lock collateral — Add money first`
    );
  }

  // Heal drift, then Compact prove_collateral_lock
  let synced = await alignBalanceCommitmentWithServer(vault).catch(() =>
    ensureCompactBalanceWitness(vault)
  );
  synced = await ensureCompactBalanceWitness(synced);
  const oldOpening = synced.balanceOpening!;
  const afterLockOpening = randomOpeningHex();
  const collateralOpening = randomOpeningHex();
  const afterLockBal = synced.balance - collateralAmount;
  const oldBalanceCommitment = synced.balanceCommitment;
  const newBalanceCommitment = await compactBalanceCommit(afterLockBal, afterLockOpening);
  const collateralCommitment = await compactBalanceCommit(collateralAmount, collateralOpening);

  // Disburse loan into free balance
  const disbursedOpening = randomOpeningHex();
  const disbursedBal = afterLockBal + loanAmount;
  const disbursedBalanceCommitment = await compactBalanceCommit(disbursedBal, disbursedOpening);

  const data = await post("/api/skills/circled-credit/borrow", {
    userId: synced.userId,
    loanAmount,
    collateralAmount,
    installments: input.installments ?? 4,
    oldBalanceCommitment,
    newBalanceCommitment,
    collateralCommitment,
    balanceWitness: {
      oldBalance: synced.balance,
      collateral: collateralAmount,
      loan: loanAmount,
      oldOpening,
      newOpening: afterLockOpening,
      collateralOpening,
    },
    disbursedBalanceCommitment,
    disbursementWitness: {
      oldBalance: afterLockBal,
      amount: loanAmount,
      oldOpening: afterLockOpening,
      newOpening: disbursedOpening,
    },
  });

  // Local vault: lock collateral, then credit disbursement (loan history — not a payment)
  let next = await applySpend(
    synced,
    collateralAmount,
    synced.policy.periodCounters,
    {
      balanceNonce: synced.balanceNonce,
      balanceOpening: afterLockOpening,
      balanceCommitment: newBalanceCommitment,
      policyNonce: synced.policy.nonce,
      policyCommitment: synced.policy.commitment,
    },
    { recipient: "Collateral locked", category: "loan" }
  );
  next = await applyCredit(
    next,
    loanAmount,
    {
      balanceOpening: disbursedOpening,
      balanceCommitment: disbursedBalanceCommitment,
    },
    { recipient: "Loan disbursed", category: "loan" }
  );
  // Track locked collateral privately on device
  const locked = {
    ...(next as DeviceVaultState & { lockedCollateral?: Record<string, number> }).lockedCollateral,
    [data.loan.id]: collateralAmount,
  };
  next = { ...next, lockedCollateral: locked } as DeviceVaultState;
  await saveVault(next);
  return { data, vault: next };
}

export async function creditRepay(vault: DeviceVaultState, loanId: string, installmentAmount: number) {
  if (vault.balance < installmentAmount) {
    throw new Error("Insufficient balance to repay");
  }
  const synced = await ensureCompactBalanceWitness(vault);
  const oldOpening = synced.balanceOpening!;
  const newOpening = randomOpeningHex();
  const newBal = synced.balance - installmentAmount;
  const oldBalanceCommitment = synced.balanceCommitment;
  const newBalanceCommitment = await compactBalanceCommit(newBal, newOpening);

  const data = await post("/api/skills/circled-credit/repay", {
    userId: synced.userId,
    loanId,
    oldBalanceCommitment,
    newBalanceCommitment,
    balanceWitness: {
      oldBalance: synced.balance,
      amount: installmentAmount,
      oldOpening,
      newOpening,
    },
  });

  let next = await applySpend(synced, installmentAmount, synced.policy.periodCounters, {
    balanceNonce: synced.balanceNonce,
    balanceOpening: newOpening,
    balanceCommitment: newBalanceCommitment,
    policyNonce: synced.policy.nonce,
    policyCommitment: synced.policy.commitment,
  });

  // Unlock collateral into free balance when loan fully repaid
  if (data.collateralUnlockPending) {
    const lockedMap =
      (next as DeviceVaultState & { lockedCollateral?: Record<string, number> }).lockedCollateral ??
      {};
    const col = lockedMap[loanId] ?? 0;
    if (col > 0) {
      const unlockOpen = randomOpeningHex();
      const unlockBal = next.balance + col;
      const unlockCommit = await compactBalanceCommit(unlockBal, unlockOpen);
      // Server currently holds post-repay commitment; reseal to include unlocked collateral
      await post(`/api/users/${encodeURIComponent(next.userId)}/reseal-balance`, {
        oldBalanceCommitment: newBalanceCommitment,
        newBalanceCommitment: unlockCommit,
      });
      next = await applyCredit(next, col, {
        balanceOpening: unlockOpen,
        balanceCommitment: unlockCommit,
      });
      const { [loanId]: _, ...rest } = lockedMap;
      next = { ...next, lockedCollateral: rest } as DeviceVaultState;
    }
  }

  await saveVault(next);
  return { data, vault: next };
}

export async function creditStanding(
  userId: string,
  opts: { onTimeThreshold: number; maxDefaultsAllowed: number }
) {
  return post("/api/skills/circled-credit/standing", { userId, ...opts });
}
