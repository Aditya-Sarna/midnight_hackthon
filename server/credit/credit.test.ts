import { describe, expect, it, beforeEach } from "vitest";
import {
  compactBalanceCommit,
  openingToHex,
  randomOpening,
} from "../services/compactCommit.js";
import {
  createPublicAccount,
  issueKyc,
  STORE_SCHEMA_VERSION,
  type Store,
} from "../services/store.js";
import { deriveCreditIdentity } from "./identity.js";
import {
  borrowFromPool,
  creditSkillDocument,
  depositToPool,
  getCreditStatus,
  liquidateIfDue,
  proveStanding,
  repayLoan,
} from "./service.js";
import { creditState } from "./state.js";

function freshStore(): Store {
  return {
    schemaVersion: STORE_SCHEMA_VERSION,
    kycLeaves: [],
    kycRoot: "root",
    revokedNullifiers: [],
    spentNullifiers: [],
    users: [],
    events: [],
    vaults: [],
    notes: [],
    issuerSecret: "test-issuer-secret",
  };
}

function makeUser(store: Store, name: string, doc: string, balance: number) {
  const open = randomOpening();
  const balCommit = compactBalanceCommit(BigInt(balance), open);
  const kyc = issueKyc(store, {
    identityDocumentHash: doc,
    jurisdiction: "IN",
    pubkey: `pk-${name}`,
  });
  const user = createPublicAccount(store, {
    displayName: name,
    deviceId: `dev-${name}`,
    kyc,
    publicKeyJwk: { kty: "EC", crv: "P-256", x: "1", y: "2" },
    balanceCommitment: balCommit,
    policyCommitment: "policy",
    policyActive: ["T1"],
  });
  return { user, opening: open, balance };
}

describe("Circled Credit v1", () => {
  let store: Store;

  beforeEach(() => {
    store = freshStore();
  });

  it("documents v1 as overcollateralized, not undercollateralized", () => {
    const doc = creditSkillDocument();
    expect(doc.model.toLowerCase()).toContain("overcollateralized");
    expect(doc.model.toLowerCase()).not.toMatch(/undercollateralized lending/);
    expect(doc.sybil).toContain("credit_identity");
    expect(doc.unlinkability_exception).toMatch(/never shared/i);
  });

  it("derives stable credit_identity per KYC leaf", () => {
    const a = makeUser(store, "A", "doc-a", 1000);
    const b = makeUser(store, "B", "doc-b", 1000);
    const idA1 = deriveCreditIdentity(a.user.credentialCommitment);
    const idA2 = deriveCreditIdentity(a.user.credentialCommitment);
    const idB = deriveCreditIdentity(b.user.credentialCommitment);
    expect(idA1).toBe(idA2);
    expect(idA1).not.toBe(idB);
  });

  it("rejects borrow below 150% collateral", async () => {
    creditState(store).poolTotal = 50_000;
    const { user } = makeUser(store, "Borrower", "doc-borrow", 20_000);
    const out = await borrowFromPool(store, user, {
      loanAmount: 1000,
      collateralAmount: 1400,
      oldBalanceCommitment: user.balanceCommitment,
      newBalanceCommitment: "x",
      collateralCommitment: "y",
      balanceWitness: {
        oldBalance: 20_000,
        collateral: 1400,
        loan: 1000,
        oldOpening: "00",
        newOpening: "00",
        collateralOpening: "00",
      },
      disbursedBalanceCommitment: "z",
      disbursementWitness: {
        oldBalance: 18_600,
        amount: 1000,
        oldOpening: "00",
        newOpening: "00",
      },
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toMatch(/150%/);
  });

  it("rejects borrow when pool has no liquidity", async () => {
    const { user } = makeUser(store, "Borrower", "doc-dry", 20_000);
    const out = await borrowFromPool(store, user, {
      loanAmount: 1000,
      collateralAmount: 1500,
      oldBalanceCommitment: user.balanceCommitment,
      newBalanceCommitment: "x",
      collateralCommitment: "y",
      balanceWitness: {
        oldBalance: 20_000,
        collateral: 1500,
        loan: 1000,
        oldOpening: "00",
        newOpening: "00",
        collateralOpening: "00",
      },
      disbursedBalanceCommitment: "z",
      disbursementWitness: {
        oldBalance: 18_500,
        amount: 1000,
        oldOpening: "00",
        newOpening: "00",
      },
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toMatch(/liquidity/i);
  });

  it("pool deposit → borrow → repay → standing pass/fail", async () => {
    const lender = makeUser(store, "Lender", "doc-lend", 50_000);
    const borrower = makeUser(store, "Borrower", "doc-bor", 20_000);

    const afterDepOpen = randomOpening();
    const afterDepBal = lender.balance - 10_000;
    const afterDepCommit = compactBalanceCommit(BigInt(afterDepBal), afterDepOpen);

    const dep = await depositToPool(store, lender.user, {
      amount: 10_000,
      oldBalanceCommitment: lender.user.balanceCommitment,
      newBalanceCommitment: afterDepCommit,
      balanceWitness: {
        oldBalance: lender.balance,
        amount: 10_000,
        oldOpening: openingToHex(lender.opening),
        newOpening: openingToHex(afterDepOpen),
      },
    });
    expect(dep.ok).toBe(true);
    expect(getCreditStatus(store).pool.available).toBe(10_000);

    const afterLockOpen = randomOpening();
    const colOpen = randomOpening();
    const afterLock = borrower.balance - 1500;
    const afterLockCommit = compactBalanceCommit(BigInt(afterLock), afterLockOpen);
    const colCommit = compactBalanceCommit(1500n, colOpen);
    const disbOpen = randomOpening();
    const disbBal = afterLock + 1000;
    const disbCommit = compactBalanceCommit(BigInt(disbBal), disbOpen);

    const borrow = await borrowFromPool(store, borrower.user, {
      loanAmount: 1000,
      collateralAmount: 1500,
      installments: 2,
      oldBalanceCommitment: borrower.user.balanceCommitment,
      newBalanceCommitment: afterLockCommit,
      collateralCommitment: colCommit,
      balanceWitness: {
        oldBalance: borrower.balance,
        collateral: 1500,
        loan: 1000,
        oldOpening: openingToHex(borrower.opening),
        newOpening: openingToHex(afterLockOpen),
        collateralOpening: openingToHex(colOpen),
      },
      disbursedBalanceCommitment: disbCommit,
      disbursementWitness: {
        oldBalance: afterLock,
        amount: 1000,
        oldOpening: openingToHex(afterLockOpen),
        newOpening: openingToHex(disbOpen),
      },
    });
    expect(borrow.ok).toBe(true);
    if (!borrow.ok) return;

    expect(borrow.loan.status).toBe("active");
    expect(borrow.creditIdentity).toBe(
      deriveCreditIdentity(borrower.user.credentialCommitment)
    );
    expect(borrow.eligibility).toBe("v1_overcollateralized");

    const installment = borrow.loan.installmentAmount;
    const afterPayOpen = randomOpening();
    const afterPay = disbBal - installment;
    const afterPayCommit = compactBalanceCommit(BigInt(afterPay), afterPayOpen);

    const repay = await repayLoan(store, borrower.user, {
      loanId: borrow.loan.id,
      oldBalanceCommitment: borrower.user.balanceCommitment,
      newBalanceCommitment: afterPayCommit,
      balanceWitness: {
        oldBalance: disbBal,
        amount: installment,
        oldOpening: openingToHex(disbOpen),
        newOpening: openingToHex(afterPayOpen),
      },
    });
    expect(repay.ok).toBe(true);

    const standingFail = await proveStanding(store, borrower.user, {
      onTimeThreshold: 100,
      maxDefaultsAllowed: 0,
    });
    expect(standingFail.pass).toBe(false);
    expect(standingFail.disclosure).toBe("pass_fail_only");

    const standingPass = await proveStanding(store, borrower.user, {
      onTimeThreshold: 1,
      maxDefaultsAllowed: 0,
    });
    expect(standingPass.pass).toBe(true);
    expect(standingPass.v1Only).toBe(true);
    expect(standingPass.v2Eligible).toBe(false);
  });

  it("liquidates after grace period misses and records default on credit_identity", async () => {
    creditState(store).poolTotal = 10_000;
    creditState(store).config.gracePeriodMisses = 0;
    creditState(store).config.installmentPeriodMs = 1;

    const borrower = makeUser(store, "Defaulter", "doc-def", 20_000);
    const afterLockOpen = randomOpening();
    const colOpen = randomOpening();
    const afterLock = borrower.balance - 1500;
    const afterLockCommit = compactBalanceCommit(BigInt(afterLock), afterLockOpen);
    const colCommit = compactBalanceCommit(1500n, colOpen);
    const disbOpen = randomOpening();
    const disbCommit = compactBalanceCommit(BigInt(afterLock + 1000), disbOpen);

    const borrow = await borrowFromPool(store, borrower.user, {
      loanAmount: 1000,
      collateralAmount: 1500,
      installments: 1,
      oldBalanceCommitment: borrower.user.balanceCommitment,
      newBalanceCommitment: afterLockCommit,
      collateralCommitment: colCommit,
      balanceWitness: {
        oldBalance: borrower.balance,
        collateral: 1500,
        loan: 1000,
        oldOpening: openingToHex(borrower.opening),
        newOpening: openingToHex(afterLockOpen),
        collateralOpening: openingToHex(colOpen),
      },
      disbursedBalanceCommitment: disbCommit,
      disbursementWitness: {
        oldBalance: afterLock,
        amount: 1000,
        oldOpening: openingToHex(afterLockOpen),
        newOpening: openingToHex(disbOpen),
      },
    });
    expect(borrow.ok).toBe(true);
    if (!borrow.ok) return;

    const loan = store.circledCredit!.loans.find((l) => l.id === borrow.loan.id)!;
    loan.dueNextAt = Date.now() - 1000;

    const liq = liquidateIfDue(store, borrow.loan.id);
    expect(liq.ok).toBe(true);
    if (!liq.ok) return;
    expect(liq.liquidated).toBe(true);

    const st = await proveStanding(store, borrower.user, {
      onTimeThreshold: 0,
      maxDefaultsAllowed: 0,
    });
    expect(st.pass).toBe(false);
  });
});
