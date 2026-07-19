/**
 * Circle Credit v1 — same-asset, fully overcollateralized lending.
 * NOT undercollateralized. NOT zero-collateral. See docs/CREDIT.md §1.
 */
export const CREDIT_SKILL = "circled-credit";
export const CREDIT_VERSION = "1.0.0";

/** Default 150% collateral (basis points) — v1 same-asset floor */
export const DEFAULT_COLLATERAL_RATIO_BPS = 15_000;

/** Min on-time installments before any v2 reduced-collateral eligibility */
export const DEFAULT_MIN_HISTORY_FOR_V2 = 6;

export type LoanStatus =
  | "active"
  | "repaid"
  | "defaulted"
  | "liquidated";

export type LoanRecord = {
  id: string;
  /** Scoped identity — links loans for this person; never shared with payments/auth */
  creditIdentity: string;
  borrowerUserId: string;
  loanAmount: number;
  collateralAmount: number;
  collateralRatioBps: number;
  remaining: number;
  installmentAmount: number;
  installmentsTotal: number;
  installmentsPaid: number;
  missedInstallments: number;
  gracePeriodMisses: number;
  status: LoanStatus;
  collateralCommitment: string;
  loanCommitment: string;
  createdAt: number;
  dueNextAt: number;
  /** Opaque — Class 1; never returned as raw history outside threshold proofs */
  installmentNullifiers: string[];
};

export type PoolShare = {
  lenderUserId: string;
  shareCommitment: string;
  deposited: number;
  updatedAt: number;
};

export type CreditConfig = {
  collateralRatioBps: number;
  gracePeriodMisses: number;
  minHistoryForV2: number;
  installmentPeriodMs: number;
};

export type CreditState = {
  /** commit(pooled_capital, outstanding_loans, nonce) — public */
  poolCommitment: string;
  poolTotal: number;
  poolOutstanding: number;
  poolNonce: string;
  poolOpening: string;
  shares: PoolShare[];
  loans: LoanRecord[];
  /** creditIdentity → aggregates for standing (server-side; proofs reveal pass/fail only) */
  standing: Record<
    string,
    { onTimeCount: number; defaults: number; loanIds: string[] }
  >;
  spentInstallmentNullifiers: string[];
  config: CreditConfig;
};

export function defaultCreditConfig(): CreditConfig {
  return {
    collateralRatioBps: DEFAULT_COLLATERAL_RATIO_BPS,
    gracePeriodMisses: 2,
    minHistoryForV2: DEFAULT_MIN_HISTORY_FOR_V2,
    installmentPeriodMs: 7 * 86_400_000,
  };
}
