/**
 * Circle Credit v1 service — pool-funded, same-asset overcollateralized loans.
 * Compact circuits for lock / pool deposit / repay / standing when artifacts present.
 */
import { randomNonce, sha256 } from "../services/crypto.js";
import {
  compactBalanceCommit,
  hexToOpening,
  openingToHex,
  randomOpening,
} from "../services/compactCommit.js";
import {
  artifactsPresent,
  creditArtifactsPresent,
  runCollateralLock,
  runCreditStanding,
  runLoanRepayment,
  runPoolDeposit,
} from "../services/compactLedger.js";
import { saveStore, type PublicAccount, type Store } from "../services/store.js";
import {
  assertCreditEligible,
  borrowerRateDisclosure,
  creditComplianceConfig,
  creditComplianceDocument,
  disclosureAckHash,
} from "./compliance.js";
import { deriveCreditIdentity, encodeThresholdCommitment } from "./identity.js";
import { creditState } from "./state.js";
import type { LoanRecord } from "./types.js";

function poolCommit(total: number, outstanding: number, nonce: string): string {
  return sha256(`pool:${total}:${outstanding}:${nonce}`);
}

function loanCommit(input: {
  creditIdentity: string;
  loanAmount: number;
  collateralAmount: number;
  remaining: number;
  nonce: string;
}): string {
  return sha256(
    `loan:${input.creditIdentity}|${input.loanAmount}|${input.collateralAmount}|${input.remaining}|${input.nonce}`
  );
}

export function creditSkillDocument() {
  const compliance = creditComplianceDocument();
  return {
    skill: "circled-credit",
    version: "1.1.0",
    model: "v1 same-asset overcollateralized — NOT undercollateralized / NOT zero-collateral",
    sybil: "credit_identity = hash(kyc_leaf, credit-scope-salt) — scoped linkability only inside lending",
    unlinkability_exception:
      "credit_identity is never shared with payments or Circle-Auth relying parties",
    circuits: [
      "prove_collateral_lock",
      "prove_pool_deposit",
      "prove_loan_repayment",
      "prove_credit_standing",
      "prove_pool_solvency",
    ],
    standing:
      "prove_credit_standing enforces on_time≥threshold and defaults≤max in-circuit; output is pass/fail only",
    compliance,
    endpoints: {
      skill: "GET /api/skills/circled-credit",
      status: "GET /api/skills/circled-credit/status",
      disclosure: "GET /api/skills/circled-credit/disclosure",
      deposit: "POST /api/skills/circled-credit/pool/deposit",
      borrow: "POST /api/skills/circled-credit/borrow",
      repay: "POST /api/skills/circled-credit/repay",
      standing: "POST /api/skills/circled-credit/standing",
      liquidate: "POST /api/skills/circled-credit/liquidate",
      identity: "POST /api/skills/circled-credit/identity",
      bureau: "POST /api/skills/circled-credit/bureau-furnish",
    },
    exit_criterion:
      "Lender verifies credit standing as pass/fail only; no payment↔credit linkability; defaults cannot mint a clean credit_identity without a second KYC credential; capital is pool-sourced with no lender-borrower link; bureau-furnishing mode is explicit.",
  };
}

export function getCreditStatus(store: Store) {
  const s = creditState(store);
  return {
    ok: true as const,
    pool: {
      commitment: s.poolCommitment,
      total: s.poolTotal,
      outstanding: s.poolOutstanding,
      available: Math.max(0, s.poolTotal - s.poolOutstanding),
      shares: s.shares.length,
    },
    loans: {
      active: s.loans.filter((l) => l.status === "active").length,
      repaid: s.loans.filter((l) => l.status === "repaid").length,
      defaulted: s.loans.filter((l) => l.status === "defaulted" || l.status === "liquidated")
        .length,
    },
    config: s.config,
    compliance: creditComplianceConfig(),
    compactArtifacts: artifactsPresent(),
    creditCompactArtifacts: creditArtifactsPresent(),
  };
}

const BORROW_DEAL_CATALOG = [
  {
    id: "quick",
    label: "Quick",
    blurb: "Pay it back soon · lowest interest",
    installments: 2,
  },
  {
    id: "standard",
    label: "Standard",
    blurb: "Balanced term · most common",
    installments: 4,
  },
  {
    id: "flex",
    label: "Flex",
    blurb: "Smaller installments · longer haul",
    installments: 6,
  },
  {
    id: "stretch",
    label: "Stretch",
    blurb: "Lowest monthly · more total interest",
    installments: 8,
  },
] as const;

/** Prefetch APR / collateral disclosure for voice + UI (no loan created) */
export function previewBorrowDisclosure(input: {
  loanAmount: number;
  collateralAmount: number;
  installments?: number;
}) {
  const cfg = creditComplianceConfig();
  const installments = Math.max(1, Math.floor(Number(input.installments ?? 4)));
  const disclosure = borrowerRateDisclosure({
    loanAmount: Math.floor(Number(input.loanAmount)),
    installments,
    aprBps: cfg.disclosedAprBps,
    collateralAmount: Math.floor(Number(input.collateralAmount)),
    collateralRatioBps: 15_000,
  });
  return { ok: true as const, disclosure, compliance: cfg };
}

/** Multiple term packages after someone asks to borrow — pick a deal before Accept */
export function previewBorrowDeals(input: {
  loanAmount: number;
  collateralAmount: number;
}) {
  const cfg = creditComplianceConfig();
  const loanAmount = Math.floor(Number(input.loanAmount));
  const collateralAmount = Math.floor(Number(input.collateralAmount));
  const deals = BORROW_DEAL_CATALOG.map((deal) => {
    const disclosure = borrowerRateDisclosure({
      loanAmount,
      installments: deal.installments,
      aprBps: cfg.disclosedAprBps,
      collateralAmount,
      collateralRatioBps: 15_000,
    });
    return {
      id: deal.id,
      label: deal.label,
      blurb: deal.blurb,
      installments: deal.installments,
      recommended: deal.id === "standard",
      disclosure,
    };
  });
  const defaultDeal = deals.find((d) => d.recommended) ?? deals[1] ?? deals[0];
  return {
    ok: true as const,
    deals,
    disclosure: defaultDeal?.disclosure,
    compliance: cfg,
  };
}

export function issueCreditIdentity(user: PublicAccount) {
  const creditIdentity = deriveCreditIdentity(user.credentialCommitment);
  return {
    ok: true as const,
    creditIdentity,
    note: "Scoped to Circle Credit only — never send to payment counterparties or Circle-Auth RPs",
  };
}

export async function depositToPool(
  store: Store,
  lender: PublicAccount,
  input: {
    amount: number;
    oldBalanceCommitment: string;
    newBalanceCommitment: string;
    balanceWitness: {
      oldBalance: number;
      amount: number;
      oldOpening: string;
      newOpening: string;
    };
  }
) {
  const s = creditState(store);
  const amount = Math.floor(Number(input.amount));
  if (!(amount > 0)) return { ok: false as const, reason: "amount must be > 0" };
  if (input.oldBalanceCommitment !== lender.balanceCommitment) {
    return { ok: false as const, reason: "Stale lender balance commitment" };
  }
  if (input.balanceWitness.amount !== amount) {
    return { ok: false as const, reason: "balanceWitness.amount mismatch" };
  }

  const oldPool = s.poolTotal;
  const newPool = oldPool + amount;
  const poolOldOpen = hexToOpening(s.poolOpening);
  const poolNewOpen = randomOpening();
  const oldPoolCommit = compactBalanceCommit(BigInt(oldPool), poolOldOpen);
  const newPoolCommit = compactBalanceCommit(BigInt(newPool), poolNewOpen);

  let compact: Awaited<ReturnType<typeof runPoolDeposit>> | null = null;
  if (creditArtifactsPresent()) {
    try {
      compact = await runPoolDeposit({
        oldPoolCommitment: oldPoolCommit,
        newPoolCommitment: newPoolCommit,
        oldLenderBalanceCommitment: input.oldBalanceCommitment,
        newLenderBalanceCommitment: input.newBalanceCommitment,
        witness: {
          poolOldTotal: oldPool,
          deposit: amount,
          poolOldOpening: openingToHex(poolOldOpen),
          poolNewOpening: openingToHex(poolNewOpen),
          lenderOldBalance: input.balanceWitness.oldBalance,
          lenderOldOpening: input.balanceWitness.oldOpening,
          lenderNewOpening: input.balanceWitness.newOpening,
        },
      });
    } catch (e) {
      return {
        ok: false as const,
        reason: e instanceof Error ? e.message : "prove_pool_deposit failed",
      };
    }
  }

  const nf = sha256(`balnf:${lender.balanceCommitment}`);
  if (store.spentNullifiers.includes(nf)) {
    return { ok: false as const, reason: "Nullifier already spent" };
  }
  store.spentNullifiers.push(nf);
  lender.balanceCommitment = input.newBalanceCommitment;

  s.poolTotal = newPool;
  s.poolOpening = openingToHex(poolNewOpen);
  s.poolNonce = randomNonce(16);
  s.poolCommitment = poolCommit(s.poolTotal, s.poolOutstanding, s.poolNonce);

  const shareCommitment = sha256(`share:${lender.id}|${amount}|${Date.now()}`);
  const existing = s.shares.find((x) => x.lenderUserId === lender.id);
  if (existing) {
    existing.deposited += amount;
    existing.shareCommitment = sha256(`${existing.shareCommitment}|${shareCommitment}`);
    existing.updatedAt = Date.now();
  } else {
    s.shares.push({
      lenderUserId: lender.id,
      shareCommitment,
      deposited: amount,
      updatedAt: Date.now(),
    });
  }

  saveStore(store);
  return {
    ok: true as const,
    poolCommitment: s.poolCommitment,
    poolTotal: s.poolTotal,
    shareCommitment,
    compactProved: Boolean(compact),
    note: "Deposit pooled — no lender-borrower link created",
  };
}

export async function borrowFromPool(
  store: Store,
  borrower: PublicAccount,
  input: {
    loanAmount: number;
    collateralAmount: number;
    installments?: number;
    oldBalanceCommitment: string;
    newBalanceCommitment: string;
    collateralCommitment: string;
    balanceWitness: {
      oldBalance: number;
      collateral: number;
      loan: number;
      oldOpening: string;
      newOpening: string;
      collateralOpening: string;
    };
    /** After lock, loan disbursement credits borrower — new free balance after credit */
    disbursedBalanceCommitment: string;
    disbursementWitness: {
      oldBalance: number;
      amount: number;
      oldOpening: string;
      newOpening: string;
    };
  }
) {
  const s = creditState(store);
  const loanAmount = Math.floor(Number(input.loanAmount));
  const collateralAmount = Math.floor(Number(input.collateralAmount));
  const installments = Math.max(1, Math.floor(Number(input.installments ?? 4)));

  if (!(loanAmount > 0) || !(collateralAmount > 0)) {
    return { ok: false as const, reason: "loan and collateral must be > 0" };
  }
  // 150% floor: 2*collateral >= 3*loan
  if (2 * collateralAmount < 3 * loanAmount) {
    return {
      ok: false as const,
      reason: `v1 requires ≥150% same-asset collateral (need ${Math.ceil((loanAmount * 3) / 2)}, got ${collateralAmount})`,
    };
  }
  const eligible = assertCreditEligible(store, borrower);
  if (!eligible.ok) return eligible;

  const available = s.poolTotal - s.poolOutstanding;
  if (loanAmount > available) {
    return { ok: false as const, reason: "Insufficient pool liquidity" };
  }
  if (input.oldBalanceCommitment !== borrower.balanceCommitment) {
    return { ok: false as const, reason: "Stale borrower balance commitment" };
  }

  const creditIdentity = deriveCreditIdentity(borrower.credentialCommitment);
  const loanNonce = randomNonce(16);
  // Principal amortization on-ledger; APR interest disclosed to borrower (TILA-style)
  const installmentAmount = Math.ceil(loanAmount / installments);
  const rateDisclosure = borrowerRateDisclosure({
    loanAmount,
    installments,
    aprBps: eligible.config.disclosedAprBps,
    collateralAmount,
    collateralRatioBps: s.config.collateralRatioBps,
  });
  const loanCommitment = loanCommit({
    creditIdentity,
    loanAmount,
    collateralAmount,
    remaining: loanAmount,
    nonce: loanNonce,
  });

  let compact: Awaited<ReturnType<typeof runCollateralLock>> | null = null;
  if (creditArtifactsPresent()) {
    // Preflight: opening must open the public commitment (avoids opaque Compact assert)
    try {
      const opened = compactBalanceCommit(
        BigInt(input.balanceWitness.oldBalance),
        hexToOpening(input.balanceWitness.oldOpening)
      );
      if (opened !== input.oldBalanceCommitment) {
        return {
          ok: false as const,
          reason:
            "Balance opening out of sync with commitment — retry loan (vault will reseal automatically)",
        };
      }
    } catch {
      return { ok: false as const, reason: "Invalid balance opening for Compact lock" };
    }
    try {
      compact = await runCollateralLock({
        oldBalanceCommitment: input.oldBalanceCommitment,
        newBalanceCommitment: input.newBalanceCommitment,
        collateralCommitment: input.collateralCommitment,
        loanCommitment,
        witness: {
          oldBalance: input.balanceWitness.oldBalance,
          collateral: input.balanceWitness.collateral,
          loan: input.balanceWitness.loan,
          oldOpening: input.balanceWitness.oldOpening,
          newOpening: input.balanceWitness.newOpening,
          collateralOpening: input.balanceWitness.collateralOpening,
        },
      });
    } catch (e) {
      return {
        ok: false as const,
        reason: e instanceof Error ? e.message : "prove_collateral_lock failed",
      };
    }
  }

  const nf = sha256(`balnf:${borrower.balanceCommitment}`);
  if (store.spentNullifiers.includes(nf)) {
    return { ok: false as const, reason: "Nullifier already spent" };
  }
  store.spentNullifiers.push(nf);

  // Lock applied → then disburse loan into free balance (credit-like)
  const nf2 = sha256(`balnf:${input.newBalanceCommitment}`);
  if (store.spentNullifiers.includes(nf2)) {
    return { ok: false as const, reason: "Disbursement nullifier conflict" };
  }
  store.spentNullifiers.push(nf2);
  borrower.balanceCommitment = input.disbursedBalanceCommitment;

  s.poolOutstanding += loanAmount;
  s.poolNonce = randomNonce(16);
  s.poolCommitment = poolCommit(s.poolTotal, s.poolOutstanding, s.poolNonce);

  const loan: LoanRecord = {
    id: `loan_${randomNonce(8)}`,
    creditIdentity,
    borrowerUserId: borrower.id,
    loanAmount,
    collateralAmount,
    collateralRatioBps: s.config.collateralRatioBps,
    remaining: loanAmount,
    installmentAmount,
    installmentsTotal: installments,
    installmentsPaid: 0,
    missedInstallments: 0,
    gracePeriodMisses: s.config.gracePeriodMisses,
    status: "active",
    collateralCommitment: input.collateralCommitment,
    loanCommitment,
    createdAt: Date.now(),
    dueNextAt: Date.now() + s.config.installmentPeriodMs,
    installmentNullifiers: [],
  };
  s.loans.push(loan);

  if (!s.standing[creditIdentity]) {
    s.standing[creditIdentity] = { onTimeCount: 0, defaults: 0, loanIds: [] };
  }
  s.standing[creditIdentity].loanIds.push(loan.id);

  saveStore(store);
  return {
    ok: true as const,
    loan: publicLoan(store, loan),
    creditIdentity,
    poolCommitment: s.poolCommitment,
    compactProved: Boolean(compact),
    eligibility: "v1_overcollateralized",
    jurisdiction: eligible.jurisdiction,
    disclosure: rateDisclosure,
    disclosureAck: disclosureAckHash(rateDisclosure, borrower.id),
    bureauFurnishing: eligible.config.bureauFurnishing,
    note: "First-time / any borrower: v1 fully overcollateralized terms only until history accrues",
  };
}

export async function repayLoan(
  store: Store,
  borrower: PublicAccount,
  input: {
    loanId: string;
    oldBalanceCommitment: string;
    newBalanceCommitment: string;
    balanceWitness: {
      oldBalance: number;
      amount: number;
      oldOpening: string;
      newOpening: string;
    };
  }
) {
  const s = creditState(store);
  const loan = s.loans.find((l) => l.id === input.loanId);
  if (!loan) return { ok: false as const, reason: "Loan not found" };
  if (loan.borrowerUserId !== borrower.id) {
    return { ok: false as const, reason: "Not your loan" };
  }
  if (loan.status !== "active") {
    return { ok: false as const, reason: `Loan is ${loan.status}` };
  }
  if (input.oldBalanceCommitment !== borrower.balanceCommitment) {
    return { ok: false as const, reason: "Stale balance commitment" };
  }

  const creditIdentity = deriveCreditIdentity(borrower.credentialCommitment);
  if (creditIdentity !== loan.creditIdentity) {
    return { ok: false as const, reason: "credit_identity mismatch" };
  }

  const pay = Math.min(loan.installmentAmount, loan.remaining);
  if (input.balanceWitness.amount !== pay) {
    return { ok: false as const, reason: `Installment amount must be ${pay}` };
  }

  const remainingOld = loan.remaining;
  const remainingNew = remainingOld - pay;
  const installmentNullifier = sha256(
    `instnf:${loan.id}|${loan.installmentsPaid}|${creditIdentity}`
  );
  if (s.spentInstallmentNullifiers.includes(installmentNullifier)) {
    return { ok: false as const, reason: "Installment already counted" };
  }

  const loanNonce = randomNonce(16);
  const loanCommitmentNew = loanCommit({
    creditIdentity,
    loanAmount: loan.loanAmount,
    collateralAmount: loan.collateralAmount,
    remaining: remainingNew,
    nonce: loanNonce,
  });

  let compact: Awaited<ReturnType<typeof runLoanRepayment>> | null = null;
  if (creditArtifactsPresent()) {
    try {
      compact = await runLoanRepayment({
        loanCommitmentOld: loan.loanCommitment,
        loanCommitmentNew,
        installmentNullifier,
        creditIdentity,
        witness: {
          installment: pay,
          remainingOld,
          remainingNew,
        },
      });
    } catch (e) {
      return {
        ok: false as const,
        reason: e instanceof Error ? e.message : "prove_loan_repayment failed",
      };
    }
  }

  const nf = sha256(`balnf:${borrower.balanceCommitment}`);
  if (store.spentNullifiers.includes(nf)) {
    return { ok: false as const, reason: "Nullifier already spent" };
  }
  store.spentNullifiers.push(nf);
  borrower.balanceCommitment = input.newBalanceCommitment;

  const onTime = Date.now() <= loan.dueNextAt + 86_400_000;
  loan.remaining = remainingNew;
  loan.installmentsPaid += 1;
  loan.loanCommitment = loanCommitmentNew;
  loan.installmentNullifiers.push(installmentNullifier);
  s.spentInstallmentNullifiers.push(installmentNullifier);
  loan.dueNextAt = Date.now() + s.config.installmentPeriodMs;

  s.poolOutstanding = Math.max(0, s.poolOutstanding - pay);
  s.poolNonce = randomNonce(16);
  s.poolCommitment = poolCommit(s.poolTotal, s.poolOutstanding, s.poolNonce);

  if (onTime) {
    s.standing[creditIdentity].onTimeCount += 1;
  } else {
    loan.missedInstallments += 1;
  }

  if (loan.remaining === 0) {
    loan.status = "repaid";
    // Collateral unlock is client-driven via a follow-up credit to free balance
  }

  saveStore(store);
  return {
    ok: true as const,
    loan: publicLoan(store, loan),
    installmentNullifier,
    onTime,
    compactProved: Boolean(compact),
    collateralUnlockPending: loan.status === "repaid",
  };
}

export async function proveStanding(
  store: Store,
  user: PublicAccount,
  input: { onTimeThreshold: number; maxDefaultsAllowed: number }
) {
  const s = creditState(store);
  const creditIdentity = deriveCreditIdentity(user.credentialCommitment);
  const st = s.standing[creditIdentity] ?? { onTimeCount: 0, defaults: 0, loanIds: [] };
  const threshold = Math.max(0, Math.floor(input.onTimeThreshold));
  const maxDef = Math.max(0, Math.floor(input.maxDefaultsAllowed));

  const pass = st.onTimeCount >= threshold && st.defaults <= maxDef;

  const thrBind = encodeThresholdCommitment(threshold);
  const maxBind = encodeThresholdCommitment(maxDef);

  let compact: Awaited<ReturnType<typeof runCreditStanding>> | null = null;
  if (creditArtifactsPresent() && pass) {
    try {
      compact = await runCreditStanding({
        creditIdentity,
        onTimeThreshold: thrBind.commitment,
        maxDefaultsAllowed: maxBind.commitment,
        witness: {
          onTimeCount: st.onTimeCount,
          defaultCount: st.defaults,
          onTimeThreshold: thrBind.value,
          maxDefaults: maxBind.value,
          thrOpening: thrBind.opening,
          maxDefOpening: maxBind.opening,
        },
      });
    } catch (e) {
      return {
        ok: false as const,
        reason: e instanceof Error ? e.message : "prove_credit_standing failed",
        pass: false,
      };
    }
  }

  const v2Eligible =
    pass && st.onTimeCount >= s.config.minHistoryForV2 && st.defaults === 0;

  return {
    ok: true as const,
    pass,
    creditIdentity,
    /** Threshold proof only — never expose raw counts in production APIs for lenders */
    disclosure: "pass_fail_only" as const,
    thresholdsBound: {
      onTimeThreshold: thrBind.commitment,
      maxDefaultsAllowed: maxBind.commitment,
    },
    v1Only: !v2Eligible,
    v2Eligible,
    minHistoryForV2: s.config.minHistoryForV2,
    compactProved: Boolean(compact),
    circuitEnforced: Boolean(compact),
    note: pass
      ? "Standing threshold met (pass/fail only — counts enforced in Compact when proved)"
      : "Standing threshold not met — v1 overcollateralized terms only",
  };
}

/** Mark missed installments / liquidate after grace — same-asset v1 */
export function liquidateIfDue(store: Store, loanId: string) {
  const s = creditState(store);
  const loan = s.loans.find((l) => l.id === loanId);
  if (!loan) return { ok: false as const, reason: "Loan not found" };
  if (loan.status !== "active") {
    return { ok: false as const, reason: `Loan is ${loan.status}` };
  }

  if (Date.now() <= loan.dueNextAt) {
    return { ok: false as const, reason: "Installment not yet overdue" };
  }

  loan.missedInstallments += 1;
  loan.dueNextAt = Date.now() + s.config.installmentPeriodMs;

  if (loan.missedInstallments > loan.gracePeriodMisses) {
    loan.status = "liquidated";
    s.standing[loan.creditIdentity] = s.standing[loan.creditIdentity] ?? {
      onTimeCount: 0,
      defaults: 0,
      loanIds: [],
    };
    s.standing[loan.creditIdentity].defaults += 1;
    // Collateral claimable by pool — outstanding reduced by remaining (absorbed)
    s.poolOutstanding = Math.max(0, s.poolOutstanding - loan.remaining);
    s.poolTotal += loan.collateralAmount; // collateral seized into pool (same-asset)
    loan.remaining = 0;
    s.poolNonce = randomNonce(16);
    s.poolCommitment = poolCommit(s.poolTotal, s.poolOutstanding, s.poolNonce);
    saveStore(store);
    return {
      ok: true as const,
      liquidated: true,
      loan: publicLoan(store, loan),
      note: "Collateral claimed by pool — default recorded against credit_identity",
    };
  }

  saveStore(store);
  return {
    ok: true as const,
    liquidated: false,
    missedInstallments: loan.missedInstallments,
    loan: publicLoan(store, loan),
    note: "Miss recorded — still within grace period",
  };
}

function publicLoan(store: Store, loan: LoanRecord) {
  const s = creditState(store);
  const periodMs = s.config.installmentPeriodMs;
  const aprBps = creditComplianceConfig().disclosedAprBps;
  const remainingInstallments = Math.max(0, loan.installmentsTotal - loan.installmentsPaid);
  const day = 86_400_000;
  return {
    id: loan.id,
    creditIdentity: loan.creditIdentity,
    loanAmount: loan.loanAmount,
    collateralAmount: loan.collateralAmount,
    remaining: loan.remaining,
    installmentAmount: loan.installmentAmount,
    installmentsPaid: loan.installmentsPaid,
    installmentsTotal: loan.installmentsTotal,
    status: loan.status,
    collateralCommitment: loan.collateralCommitment,
    loanCommitment: loan.loanCommitment,
    dueNextAt: loan.dueNextAt,
    createdAt: loan.createdAt,
    /** Disclosed APR (bps) — TILA-style; Class 1 public to borrower */
    aprBps,
    aprPercent: `${(aprBps / 100).toFixed(2)}%`,
    installmentPeriodDays: Math.max(1, Math.round(periodMs / day)),
    termDays: Math.max(1, Math.round((loan.installmentsTotal * periodMs) / day)),
    remainingTermDays: Math.round((remainingInstallments * periodMs) / day),
    collateralRatioPercent: `${(loan.collateralRatioBps / 100).toFixed(0)}%`,
    // Never expose installmentNullifiers list or raw default detail here
  };
}

export function listBorrowerLoans(store: Store, userId: string) {
  const s = creditState(store);
  return s.loans
    .filter((l) => l.borrowerUserId === userId)
    .map((l) => publicLoan(store, l));
}
