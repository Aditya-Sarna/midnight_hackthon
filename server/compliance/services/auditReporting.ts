import type { Store } from "../../services/store.js";
import { COMPLIANCE_GAPS, REGULATORY_MAPPING } from "../posture.js";

/**
 * Audit & Reporting Service (§1 / §4)
 * Touches: nullifier-set changes, revocation events, aggregates
 * Must NOT touch: private-state content — structurally cannot reveal amount/party/balance
 */
export class AuditReportingService {
  constructor(private store: Store) {}

  /**
   * Regulator-facing report from public state only.
   * Intentionally incapable of including amounts, parties, or balances.
   */
  generatePublicReport(opts?: { from?: number; to?: number }) {
    const from = opts?.from ?? 0;
    const to = opts?.to ?? Date.now();

    const revocations = (this.store.revocationEvents ?? []).filter(
      (e) => e.timestamp >= from && e.timestamp <= to
    );
    const released = this.store.events.filter(
      (e) => e.released && e.timestamp >= from && e.timestamp <= to
    );
    const transfers = released.filter((e) => e.type === "valid_transfer");
    const decoys = released.filter((e) => e.type === "decoy");
    const kycCommits = released.filter((e) => e.type === "kyc_commit");

    return {
      generatedAt: Date.now(),
      window: { from, to },
      dataClass: 1 as const,
      aggregates: {
        validTransferEvents: transfers.length,
        decoyEvents: decoys.length,
        kycCommitmentEvents: kycCommits.length,
        revokedNullifiers: this.store.revokedNullifiers.length,
        revocationEventsInWindow: revocations.length,
        activeKycLeaves: this.store.kycLeaves.filter((l) => !l.revoked).length,
      },
      revocations: revocations.map((e) => ({
        nullifierHint: `${e.nullifier.slice(0, 10)}…`,
        reasonCode: e.reasonCode,
        timestamp: e.timestamp,
      })),
      structuralGuarantee:
        "Report contains no amounts, parties, balances, or policy parameters — service never has access to them.",
      sarStrPosture: COMPLIANCE_GAPS.find((g) => g.id === "sar-str"),
      regulatoryNotes: {
        recordkeeping: REGULATORY_MAPPING.recordkeeping,
        revocationEnforcement: REGULATORY_MAPPING.revocationEnforcement,
      },
    };
  }
}
