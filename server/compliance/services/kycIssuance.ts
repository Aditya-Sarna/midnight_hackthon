import { randomNonce, sha256, hmacSign } from "../../services/crypto.js";
import type { Store } from "../../services/store.js";
import { CLASS2_RETENTION_MS } from "../classification.js";

/** Class 2 — issuance metadata only (never raw ID / biometrics) */
export interface IssuanceRecord {
  id: string;
  /** Opaque issuance id — NOT linkable to Midnight nullifier without issuer secrets */
  issuanceRef: string;
  pass: boolean;
  jurisdiction: string;
  sanctionsClear: boolean;
  sanctionsCheckedAt: number;
  createdAt: number;
  /** Credential commitment published (Class 1) — no preimage */
  credentialCommitment?: string;
  dataClass: 2;
  /** Sandbox / provider metadata (never raw biometrics) */
  provider?: string;
  livenessPass?: boolean;
  documentCheckPass?: boolean;
  exceptionCode?: string | null;
}

/** Pluggable KYC issuer — sandbox today; swap for DigiLocker / Onfido / etc. */
export interface KycProvider {
  id: string;
  verify(input: {
    documentReferenceHash: string;
    jurisdiction: string;
  }): {
    pass: boolean;
    sanctionsClear: boolean;
    livenessPass: boolean;
    documentCheckPass: boolean;
    exceptionCode: string | null;
  };
}

export class SandboxKycProvider implements KycProvider {
  id = "sandbox-govt-issuer-v1";
  verify(input: { documentReferenceHash: string; jurisdiction: string }) {
    const hashOk = Boolean(
      input.documentReferenceHash && input.documentReferenceHash.length >= 8
    );
    // Deterministic sandbox: refs ending in "fail" force exception path for demos
    const forceFail = /fail$/i.test(input.documentReferenceHash);
    const pass = hashOk && !forceFail;
    return {
      pass,
      sanctionsClear: pass,
      livenessPass: pass,
      documentCheckPass: hashOk,
      exceptionCode: forceFail ? "SANDBOX_FORCED_FAIL" : pass ? null : "DOC_REF_INVALID",
    };
  }
}

/**
 * KYC Issuance Service (§1)
 * Touches: pass/fail, jurisdiction, sanctions result
 * Must NOT touch: raw ID documents, biometrics, full name/address
 */
export class KycIssuanceService {
  private provider: KycProvider;

  constructor(
    private store: Store,
    provider: KycProvider = new SandboxKycProvider()
  ) {
    this.provider = provider;
  }

  /**
   * Government issuer interface. Device sends only a document *reference hash*,
   * never the raw document (Class 0 stays on device / with issuer).
   */
  issue(input: {
    documentReferenceHash: string;
    jurisdiction: string;
  }): { record: IssuanceRecord; issuerSig: string; identityHash: string } {
    const v = this.provider.verify(input);
    const identityHash = sha256(`issuer:idhash:${input.documentReferenceHash}`);
    const issuerSig = hmacSign(
      this.store.issuerSecret,
      `${identityHash}|${input.jurisdiction}|${v.sanctionsClear}|${v.pass}`
    );

    const record: IssuanceRecord = {
      id: randomNonce(8),
      issuanceRef: sha256(`issref:${identityHash}:${Date.now()}`).slice(0, 24),
      pass: v.pass,
      jurisdiction: input.jurisdiction,
      sanctionsClear: v.sanctionsClear,
      sanctionsCheckedAt: Date.now(),
      createdAt: Date.now(),
      dataClass: 2,
      provider: this.provider.id,
      livenessPass: v.livenessPass,
      documentCheckPass: v.documentCheckPass,
      exceptionCode: v.exceptionCode,
    };

    if (!this.store.issuanceRecords) this.store.issuanceRecords = [];
    this.store.issuanceRecords.push(record);
    if (!this.store.kycAudit) this.store.kycAudit = [];
    this.store.kycAudit.unshift({
      id: randomNonce(6),
      at: Date.now(),
      action: v.pass ? "issue_pass" : "issue_fail",
      issuanceRef: record.issuanceRef,
      detail: `${this.provider.id} · liveness=${v.livenessPass} · doc=${v.documentCheckPass} · sanctions=${v.sanctionsClear}`,
    });
    this.store.kycAudit = this.store.kycAudit.slice(0, 200);

    return { record, issuerSig, identityHash };
  }

  attachCommitment(issuanceRef: string, credentialCommitment: string) {
    const rec = this.store.issuanceRecords?.find((r) => r.issuanceRef === issuanceRef);
    if (rec) rec.credentialCommitment = credentialCommitment;
  }

  /** Purge Class 2 past regulated retention (placeholder 5y) — AML may forbid earlier erasure */
  purgeExpired(now = Date.now()) {
    if (!this.store.issuanceRecords) return 0;
    const before = this.store.issuanceRecords.length;
    this.store.issuanceRecords = this.store.issuanceRecords.filter(
      (r) => now - r.createdAt < CLASS2_RETENTION_MS
    );
    return before - this.store.issuanceRecords.length;
  }
}
