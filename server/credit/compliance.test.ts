import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  assertCreditEligible,
  borrowerRateDisclosure,
  creditComplianceConfig,
  creditComplianceDocument,
} from "./compliance.js";
import {
  createPublicAccount,
  issueKyc,
  STORE_SCHEMA_VERSION,
  type Store,
} from "../services/store.js";
import { compactBalanceCommit, randomOpening } from "../services/compactCommit.js";

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
    issuerSecret: "test-issuer",
  };
}

describe("Circled Credit compliance", () => {
  const prev = { ...process.env };

  beforeEach(() => {
    process.env.CREDIT_BUREAU_MODE = "jurisdiction_exempt";
    process.env.CREDIT_JURISDICTIONS = "IN,IN-DEMO";
    process.env.CREDIT_APR_BPS = "1200";
    delete process.env.NYXPAY_STRICT;
    delete process.env.CREDIT_SKIP_JURISDICTION;
  });

  afterEach(() => {
    process.env = { ...prev };
  });

  it("documents explicit bureau-furnishing decision", () => {
    const doc = creditComplianceDocument();
    expect(doc.bureauFurnishing.decision).toBe("jurisdiction_exempt");
    expect(doc.interestDisclosure.required).toBe(true);
    expect(doc.exitCriterion).toMatch(/bureau/i);
  });

  it("discloses APR to borrower without exposing counterparties", () => {
    const d = borrowerRateDisclosure({
      loanAmount: 1000,
      installments: 4,
      aprBps: 1200,
      collateralAmount: 1500,
      collateralRatioBps: 15_000,
    });
    expect(d.aprPercent).toBe("12.00%");
    expect(d.collateralRatioPercent).toBe("150%");
    expect(d.installmentAmount).toBe(250);
    expect(d.notice).toMatch(/150%/);
  });

  it("blocks unresolved bureau mode", () => {
    process.env.CREDIT_BUREAU_MODE = "unresolved";
    process.env.NYXPAY_STRICT = "1";
    const store = freshStore();
    const kyc = issueKyc(store, {
      identityDocumentHash: "doc",
      jurisdiction: "IN",
      pubkey: "pk",
    });
    const open = randomOpening();
    const user = createPublicAccount(store, {
      displayName: "A",
      deviceId: "d",
      kyc,
      publicKeyJwk: { kty: "EC", crv: "P-256", x: "1", y: "2" },
      balanceCommitment: compactBalanceCommit(1000n, open),
      policyCommitment: "p",
      policyActive: ["T1"],
    });
    const out = assertCreditEligible(store, user);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toMatch(/bureau/i);
  });

  it("gates jurisdiction when strict", () => {
    process.env.NYXPAY_STRICT = "1";
    process.env.CREDIT_JURISDICTIONS = "IN";
    const store = freshStore();
    const kyc = issueKyc(store, {
      identityDocumentHash: "doc-us",
      jurisdiction: "US",
      pubkey: "pk2",
    });
    const open = randomOpening();
    const user = createPublicAccount(store, {
      displayName: "B",
      deviceId: "d2",
      kyc,
      publicKeyJwk: { kty: "EC", crv: "P-256", x: "3", y: "4" },
      balanceCommitment: compactBalanceCommit(1000n, open),
      policyCommitment: "p",
      policyActive: ["T1"],
    });
    const out = assertCreditEligible(store, user);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toMatch(/Jurisdiction US/);
  });

  it("reads APR from env", () => {
    process.env.CREDIT_APR_BPS = "1800";
    expect(creditComplianceConfig().disclosedAprBps).toBe(1800);
  });
});
