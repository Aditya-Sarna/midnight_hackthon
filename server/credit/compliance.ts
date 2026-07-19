/**
 * Circle Credit compliance surface (§8) — technical gates + explicit decisions.
 * Does not grant a lending license; names what must be resolved before real money.
 */
import { hmacSign, sha256 } from "../services/crypto.js";
import type { PublicAccount, Store } from "../services/store.js";
import { SelectiveDisclosureService } from "../compliance/services/selectiveDisclosure.js";

/** How credit-bureau furnishing is handled in this deployment */
export type BureauFurnishingMode =
  /** Deploy only where bureau reporting is not mandatory for this product/size */
  | "jurisdiction_exempt"
  /** Compelled reports via view-key selective disclosure — default privacy stays pass/fail */
  | "selective_disclosure"
  /** Refuse lending until a mode is chosen */
  | "unresolved";

export type CreditComplianceConfig = {
  /** KYC jurisdictions allowed to originate v1 loans */
  allowedJurisdictions: string[];
  /** Disclosable APR in basis points (privacy of who/how-much ≠ rate secrecy) */
  disclosedAprBps: number;
  bureauFurnishing: BureauFurnishingMode;
  /** Soft demo allows IN/US demo tags; strict prod requires env allow-list */
  requireJurisdictionGate: boolean;
  product: "v1_same_asset_overcollateralized";
};

export function creditComplianceConfig(): CreditComplianceConfig {
  const raw = process.env.CREDIT_JURISDICTIONS ?? "IN,IN-DEMO,US-DEMO,US";
  const bureau = (process.env.CREDIT_BUREAU_MODE ?? "jurisdiction_exempt") as BureauFurnishingMode;
  const apr = Number(process.env.CREDIT_APR_BPS ?? 1200);
  const strict = process.env.NYXPAY_STRICT === "1" || process.env.NODE_ENV === "production";
  return {
    allowedJurisdictions: raw
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean),
    disclosedAprBps: Number.isFinite(apr) && apr >= 0 ? Math.floor(apr) : 1200,
    bureauFurnishing:
      bureau === "selective_disclosure" || bureau === "unresolved" || bureau === "jurisdiction_exempt"
        ? bureau
        : "jurisdiction_exempt",
    requireJurisdictionGate: strict && process.env.CREDIT_SKIP_JURISDICTION !== "1",
    product: "v1_same_asset_overcollateralized",
  };
}

export function resolveBorrowerJurisdiction(store: Store, user: PublicAccount): string {
  const leaf = store.kycLeaves.find((l) => l.leaf === user.credentialCommitment && !l.revoked);
  return String(leaf?.jurisdiction ?? "").toUpperCase();
}

export function assertCreditEligible(
  store: Store,
  user: PublicAccount
): { ok: true; jurisdiction: string; config: CreditComplianceConfig } | { ok: false; reason: string } {
  const config = creditComplianceConfig();
  if (config.bureauFurnishing === "unresolved") {
    return {
      ok: false,
      reason:
        "Credit bureau furnishing decision unresolved — set CREDIT_BUREAU_MODE=jurisdiction_exempt|selective_disclosure before real-money lending",
    };
  }
  const jurisdiction = resolveBorrowerJurisdiction(store, user);
  if (config.requireJurisdictionGate) {
    if (!jurisdiction) {
      return { ok: false, reason: "KYC jurisdiction missing — cannot originate credit" };
    }
    if (!config.allowedJurisdictions.includes(jurisdiction)) {
      return {
        ok: false,
        reason: `Jurisdiction ${jurisdiction} not enabled for Circle Credit (allowed: ${config.allowedJurisdictions.join(", ")})`,
      };
    }
  }
  return { ok: true, jurisdiction: jurisdiction || "DEMO", config };
}

/** Truth-in-lending style disclosure — rate is public to the borrower even when amounts stay private on-chain */
export function borrowerRateDisclosure(input: {
  loanAmount: number;
  installments: number;
  aprBps: number;
  collateralAmount: number;
  collateralRatioBps: number;
}) {
  const principal = Math.floor(input.loanAmount);
  const n = Math.max(1, Math.floor(input.installments));
  const apr = input.aprBps / 10_000;
  const interest = Math.ceil(principal * apr * (n / 12));
  const totalRepay = principal + interest;
  const principalInstallment = Math.ceil(principal / n);
  const termMonths = n;
  const termDays = n * 30;
  return {
    aprBps: input.aprBps,
    aprPercent: (input.aprBps / 100).toFixed(2) + "%",
    principal,
    estimatedInterest: interest,
    totalRepayable: totalRepay,
    /** On-ledger installment (principal); interest disclosed separately for v1 */
    installmentAmount: principalInstallment,
    installments: n,
    termMonths,
    termDays,
    termLabel: n === 1 ? "1 month" : `${n} months`,
    installmentPeriodDays: 30,
    collateralAmount: input.collateralAmount,
    collateralRatioBps: input.collateralRatioBps,
    collateralRatioPercent: (input.collateralRatioBps / 100).toFixed(0) + "%",
    model: "v1 same-asset overcollateralized — not undercollateralized",
    notice:
      "You are locking same-asset collateral ≥150% of the loan. Interest rate is disclosed to you; loan amounts remain private to others.",
  };
}

/**
 * Bureau / compelled credit-history report via selective disclosure.
 * Default API never exposes raw history — this path is explicit + attested.
 */
export function furnishCreditBureauReport(
  store: Store,
  user: PublicAccount,
  viewKey: string,
  clientPayload: {
    creditIdentity: string;
    onTimeCount: number;
    defaults: number;
    loanSummaries?: unknown[];
  }
) {
  const config = creditComplianceConfig();
  if (config.bureauFurnishing !== "selective_disclosure") {
    return {
      ok: false as const,
      reason: `Bureau furnishing mode is ${config.bureauFurnishing} — not selective_disclosure`,
    };
  }
  const sd = new SelectiveDisclosureService(store);
  if (!store.viewKeyCommitments?.[user.id]) {
    sd.issueViewKeyCommitment(user);
  }
  const attested = sd.attestAuditorProof(user, viewKey, {
    purpose: "credit_bureau_furnishing",
    creditIdentity: clientPayload.creditIdentity,
    onTimeCount: clientPayload.onTimeCount,
    defaults: clientPayload.defaults,
    loanSummaries: clientPayload.loanSummaries ?? [],
    userCommitment: user.credentialCommitment,
  });
  return {
    ok: true as const,
    mode: "selective_disclosure" as const,
    reportId: sha256(`bureau:${attested.auditorProof}`),
    attested,
    legalBasis:
      "Compelled credit-bureau furnishing under selective disclosure — not the default pass/fail standing proof",
  };
}

export function creditComplianceDocument() {
  const config = creditComplianceConfig();
  return {
    section: "Circle Credit §8",
    product: config.product,
    licensing:
      "Lending licensure (e.g. NBFC/RBI, state money-lender, consumer credit) is jurisdiction-specific legal review — not resolved by this module",
    interestDisclosure: {
      required: true,
      aprBps: config.disclosedAprBps,
      note: "Borrower always receives APR disclosure even though counterparties cannot see loan amounts",
    },
    bureauFurnishing: {
      decision: config.bureauFurnishing,
      tension:
        "prove_credit_standing reveals pass/fail only; bureau raw history requires selective_disclosure or jurisdiction_exempt scoping",
      env: "CREDIT_BUREAU_MODE=jurisdiction_exempt|selective_disclosure|unresolved",
    },
    jurisdictions: {
      allowed: config.allowedJurisdictions,
      gate: config.requireJurisdictionGate,
      env: "CREDIT_JURISDICTIONS",
    },
    collections:
      "v1 liquidation is collateral claim (same-asset). v2 reduced-collateral must be reviewed against debt-collection law before launch.",
    exitCriterion:
      "Bureau-furnishing question has an explicit jurisdictional answer before real-money v1",
  };
}

/** Stable hash of disclosure shown to borrower — for audit trail without storing PII */
export function disclosureAckHash(disclosure: ReturnType<typeof borrowerRateDisclosure>, userId: string) {
  return hmacSign(
    "circled:credit:disclosure:v1",
    `${userId}|${disclosure.aprBps}|${disclosure.principal}|${disclosure.collateralAmount}|${disclosure.installments}`
  );
}
