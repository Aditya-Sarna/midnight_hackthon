/**
 * Circle data classification (§3 Backend Compliance Document)
 * Design invariant: no service holds both identifying Class 0/2 content
 * AND durable knowledge of what a user did.
 */

export type DataClass = 0 | 1 | 2 | 3;

export const DATA_CLASSIFICATION = {
  0: {
    name: "Class 0 — never transmitted",
    examples: [
      "raw voice audio",
      "raw ID documents",
      "plaintext contact list",
      "plaintext balance",
      "plaintext policy",
    ],
    where: "Device only",
    retention: "N/A — never leaves device; audio discarded immediately after local use",
  },
  1: {
    name: "Class 1 — commitments / nullifiers",
    examples: [
      "KYC leaf commitment",
      "balance commitment",
      "policy commitment",
      "spend / revocation nullifiers",
    ],
    where: "Midnight public state",
    retention: "Indefinite (double-spend + revocation integrity); one-way, no PII",
  },
  2: {
    name: "Class 2 — issuance metadata",
    examples: ["pass/fail", "jurisdiction", "sanctions-check timestamp"],
    where: "KYC Issuance Service (transient / regulated retention)",
    retention:
      "Per AML recordkeeping in issuer jurisdiction (often 5+ years — confirm with counsel)",
  },
  3: {
    name: "Class 3 — operational / relay metadata",
    examples: ["submission timestamps", "jitter-window logs", "decoy-traffic counts"],
    where: "Settlement Relay",
    retention: "24–72h, then purged — health monitoring only, not per-user analysis",
  },
} as const;

/** Class 3 default purge window (ms) — §3 */
export const CLASS3_RETENTION_MS = 48 * 60 * 60 * 1000; // 48h mid-range of 24–72h

/** Class 2 default retention for demo (ms) — real deploy must set from regulation */
export const CLASS2_RETENTION_MS = 5 * 365.25 * 24 * 60 * 60 * 1000; // 5 years placeholder

export function assertNoClass0OnWire(payload: Record<string, unknown>) {
  const forbidden = [
    "audio",
    "rawId",
    "identityDocument",
    "plaintextBalance",
    "plaintextPolicy",
    "contactList",
    "biometric",
  ];
  for (const key of forbidden) {
    if (key in payload && payload[key] != null) {
      throw new Error(`Compliance regression: Class 0 field "${key}" must not leave device`);
    }
  }
}
