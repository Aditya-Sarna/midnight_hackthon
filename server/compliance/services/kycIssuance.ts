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
}

/**
 * KYC Issuance Service (§1)
 * Touches: pass/fail, jurisdiction, sanctions result
 * Must NOT touch: raw ID documents, biometrics, full name/address
 */
export class KycIssuanceService {
  constructor(private store: Store) {}

  /**
   * Government issuer interface. Device sends only a document *reference hash*,
   * never the raw document (Class 0 stays on device / with issuer).
   */
  issue(input: {
    documentReferenceHash: string;
    jurisdiction: string;
  }): { record: IssuanceRecord; issuerSig: string; identityHash: string } {
    // Simulated government verification — only pass/fail leaves this service
    const pass = Boolean(input.documentReferenceHash && input.documentReferenceHash.length >= 8);
    const sanctionsClear = pass; // initial screen
    const identityHash = sha256(`issuer:idhash:${input.documentReferenceHash}`);
    const issuerSig = hmacSign(
      this.store.issuerSecret,
      `${identityHash}|${input.jurisdiction}|${sanctionsClear}|true`
    );

    const record: IssuanceRecord = {
      id: randomNonce(8),
      issuanceRef: sha256(`issref:${identityHash}:${Date.now()}`).slice(0, 24),
      pass,
      jurisdiction: input.jurisdiction,
      sanctionsClear,
      sanctionsCheckedAt: Date.now(),
      createdAt: Date.now(),
      dataClass: 2,
    };

    if (!this.store.issuanceRecords) this.store.issuanceRecords = [];
    this.store.issuanceRecords.push(record);

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
