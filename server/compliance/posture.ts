/**
 * Compliance posture, regulatory mapping, and gaps to disclose (§4–§7)
 * Not legal advice — engineering checklist for auditors.
 */

export const COMPLIANCE_GAPS = [
  {
    id: "sar-str",
    title: "No default SAR/STR path",
    section: "§4 / §7",
    status: "open" as const,
    detail:
      "System proves spend compliance without revealing amount/party — cannot generate traditional transaction-level SAR from backend data alone. Requires jurisdictional scoping OR selective-disclosure (view-key / auditor-proof under due process).",
  },
  {
    id: "sanctions-staleness",
    title: "Sanctions-list staleness",
    section: "§4 / §7",
    status: "mitigated" as const,
    detail:
      "sanctions_clear is only as fresh as last check. Operational re-screen cadence is enforced (see SanctionsRescreenService); stale credentials are revoked, not silently valid.",
  },
  {
    id: "recovery-processor",
    title: "Recovery-vault processor obligations",
    section: "§5 / §7",
    status: "disclosed" as const,
    detail:
      "If a cloud-held share is used, the cloud provider is a data processor even though the share is below-threshold and cryptographically inert alone. DPA required.",
  },
  {
    id: "erasure-vs-aml",
    title: "Erasure vs. recordkeeping conflict",
    section: "§5 / §7",
    status: "disclosed" as const,
    detail:
      "Class 2 issuance metadata sits between privacy-law erasure rights and AML retention. Where they conflict, AML recordkeeping typically prevails — must be disclosed in privacy policy per jurisdiction.",
  },
  {
    id: "nyxproof-otp-reg",
    title: "CircledProof OTP regulatory equivalence",
    section: "CircledProof §7",
    status: "disclosed" as const,
    detail:
      "prove_session_auth is a 'something you have' factor; validate against jurisdiction-specific 2FA language before treating as OTP-equivalent.",
  },
] as const;

export const REGULATORY_MAPPING = {
  identityVerification:
    "Met by government-first ZK-KYC — system consumes authoritative issuer result; does not perform its own ID verification.",
  sanctionsScreening:
    "sanctions_clear in credential leaf (§3.1). Re-checked on cadence; stale → revocation.",
  recordkeeping:
    "Class 2 issuance metadata is the only regulator-facing retained record of who was verified and when.",
  sarStr:
    "No traditional TX-level SAR from backend. Paths: (1) scope to P2P under threshold, or (2) selective disclosure under lawful order.",
  revocationEnforcement:
    "Nullifier-based revocation is the AML enforcement lever without revealing past TX history.",
  dataMinimization:
    "Maps to DPDP Act 2023 / GDPR minimization — backend structurally cannot process more than commitments / pass-fail.",
  rightToErasure:
    "Class 0: local deletion. Class 2: reconciled against AML retention; conflict disclosed.",
  crossBorder:
    "Applies to Class 2 (issuer / sanctions / recovery cloud). Class 0/1 raise no transfer of personal content.",
  recoveryProcessor:
    "Cloud share holder = processor under possession doctrine; DPA required regardless of share usability.",
} as const;

export const SECURITY_CONTROLS = [
  { threat: "Credential compromise / fraud post-issuance", control: "Nullifier revocation (§3.1)" },
  { threat: "Contact-entry spoofing", control: "Recipient self-signature at enrollment (§3.2)" },
  { threat: "Device loss", control: "Threshold vault; no single custodian sufficient (§6)" },
  {
    threat: "Network timing / metadata analysis",
    control: "Jittered relay + decoys (§7) — mitigation, not proof-grade",
  },
  {
    threat: "On-device compromise",
    control: "Out of crypto scope; secure-enclave-class device protection",
  },
  { threat: "Double-spend", control: "Nullifier set checked at proof verification" },
  { threat: "Replay of old proof/commitment", control: "Nonce binding in every commitment" },
] as const;

/** Service inventory — what each service may / must not touch (§1) */
export const SERVICE_INVENTORY = [
  {
    id: "kyc-issuance",
    name: "KYC Issuance Service",
    responsibility: "Government ID provider interface; issue signed credential once",
    touches: ["Identity verification pass/fail", "jurisdiction", "sanctions-check result"],
    mustNotTouch: ["Raw ID documents", "biometric data", "full name/address"],
  },
  {
    id: "kyc-registry",
    name: "KYC Registry Writer",
    responsibility: "Publish credential commitments to Midnight Merkle tree",
    touches: ["Commitment hashes only"],
    mustNotTouch: ["Any preimage — identity hash, jurisdiction, sanctions flag"],
  },
  {
    id: "revocation",
    name: "Revocation Service",
    responsibility: "Add nullifiers to public revoked-set",
    touches: ["Nullifier values", "revocation timestamp", "reason code"],
    mustNotTouch: ["Which user/credential the nullifier maps to (not derivable)"],
  },
  {
    id: "enrollment-relay",
    name: "Recipient Enrollment Relay",
    responsibility: "One-time OOB handshake (QR/proximity)",
    touches: ["Ephemeral session tokens", "ephemeral pubkeys", "expiry"],
    mustNotTouch: ["Contact names", "addresses", "post-handshake data"],
  },
  {
    id: "proof-verification",
    name: "Proof Verification Service",
    responsibility: "Verify ZK proofs before Compact settlement",
    touches: ["Proofs", "public commitments", "nullifiers"],
    mustNotTouch: ["Balances", "amounts", "addresses", "policy contents"],
  },
  {
    id: "settlement-relay",
    name: "Settlement Relay",
    responsibility: "Batch/jitter submission + decoy traffic (§7)",
    touches: ["Encrypted/committed payloads", "submission timing"],
    mustNotTouch: ["Transaction content of any kind"],
  },
  {
    id: "recovery-coordinator",
    name: "Recovery Vault Coordinator",
    responsibility: "Facilitate threshold reconstruction; does not hold usable key alone",
    touches: ["Share metadata (outstanding, expiry)"],
    mustNotTouch: ["Reconstructed key", "decrypted bundle contents"],
  },
  {
    id: "audit-reporting",
    name: "Audit & Reporting Service",
    responsibility: "Regulator-facing reports from public-state events only",
    touches: ["Nullifier-set changes", "revocation events", "aggregate counts"],
    mustNotTouch: ["Any private-state content"],
  },
] as const;

export const FEATURE_EXPOSURE_MATRIX = [
  {
    feature: "Voice payment intent",
    userFacing: "Speak amount + recipient",
    backendVisibility: "None — STT on-device; audio never transmitted",
    regulatoryRelevant: false,
  },
  {
    feature: "KYC onboarding",
    userFacing: "One-time government issuer check",
    backendVisibility: "Pass/fail + jurisdiction + sanctions-clear only",
    regulatoryRelevant: true,
  },
  {
    feature: "Recipient resolution",
    userFacing: "Payment to correct contact",
    backendVisibility: "Only that some valid KYC'd party received a verified payment",
    regulatoryRelevant: false,
  },
  {
    feature: "Spend/policy proof",
    userFacing: "Checked against balance + private rules",
    backendVisibility: "Pass/fail of proof only",
    regulatoryRelevant: false,
  },
  {
    feature: "Settlement",
    userFacing: "Recorded on Midnight",
    backendVisibility: 'Generic "transfer occurred" event only',
    regulatoryRelevant: false,
  },
  {
    feature: "Credential revocation",
    userFacing: "Fraudulent/sanctioned credential invalidated",
    backendVisibility: "Nullifier added to public set",
    regulatoryRelevant: true,
  },
  {
    feature: "Device recovery",
    userFacing: "Restore contacts/policy/credential",
    backendVisibility: "Share threshold coordination only",
    regulatoryRelevant: false,
    note: "Cloud share may trigger processor review (§5)",
  },
] as const;

/** Sanctions re-screen cadence (ms) — operational policy, not just structural */
export const SANCTIONS_RESCREEN_MS = 24 * 60 * 60 * 1000; // daily
