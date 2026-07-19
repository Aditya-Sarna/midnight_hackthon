/**
 * Retention + SAR/STR strategy config — operational, not legal advice.
 */
export type SarStrategy =
  | "low_value_capped_wallet"
  | "licensed_partner_obligations"
  | "lawful_selective_disclosure";

/** Chosen pilot strategy: keep wallet capped; escalate via selective disclosure under order */
export const ACTIVE_SAR_STRATEGY: SarStrategy = "low_value_capped_wallet";

export const RETENTION_POLICY = {
  class3EphemeralHours: 48,
  class2YearsPlaceholder: 5,
  kycAuditDays: 365,
  paymentLifecycleDays: 90,
  voiceTranscripts: "never_persisted",
  openingsWitnesses: "never_persisted",
};

export function retentionDocument() {
  return {
    sarStrategy: ACTIVE_SAR_STRATEGY,
    sarStrategyNote:
      ACTIVE_SAR_STRATEGY === "low_value_capped_wallet"
        ? "Pilot caps CIRCLE unit velocity via riskEngine; SAR/STR filing deferred to licensed partner or counsel when volume exceeds pilot."
        : "See COMPLIANCE.md",
    retention: RETENTION_POLICY,
    selectiveDisclosure: "POST /api/compliance/selective-disclosure under lawful order",
    disclaimer: "Not legal advice. Confirm with counsel before real-money launch.",
  };
}
