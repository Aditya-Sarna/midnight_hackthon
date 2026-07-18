# Circled — Backend Compliance & Feature Document

Counterpart to the architecture/skill spec. Answers: what the backend does, what it stores, and what regulatory obligations that creates.

> Not legal advice. Confirm applicability with counsel before real deployment.

Machine-readable twin: `GET /api/compliance`

---

## 1. Backend service inventory

| Service | Responsibility | Touches | Must NOT touch |
|---|---|---|---|
| KYC Issuance | Govt ID provider interface; issue signed credential | Pass/fail, jurisdiction, sanctions result | Raw ID, biometrics, name/address |
| KYC Registry Writer | Publish commitments to Midnight Merkle tree | Commitment hashes | Any preimage |
| Revocation | Add nullifiers to public revoked-set | Nullifier, timestamp, reason code | Which user the nullifier maps to |
| Recipient Enrollment Relay | One-time OOB handshake | Ephemeral tokens/pubkeys/expiry | Contact names, addresses, post-handshake data |
| Proof Verification | Verify ZK proofs before Compact settle | Proofs, commitments, nullifiers | Balances, amounts, addresses, policy |
| Settlement Relay | Jitter + decoys (§7) | Committed payloads, timing | Transaction content |
| Recovery Vault Coordinator | Threshold reconstruction facilitation | Share metadata | Reconstructed key, decrypted bundle |
| Audit & Reporting | Regulator reports from public state | Nullifier/revocation aggregates | Private-state content |

**Design invariant:** no service has both (a) enough data to identify a user and (b) enough data to know what they did. Enforced by ZK revelation boundaries.

---

## 2. Feature → data exposure

| Feature | Backend visibility | Regulatory? |
|---|---|---|
| Voice intent | None — STT on-device | No |
| KYC onboarding | Pass/fail + jurisdiction + sanctions | Yes |
| Recipient resolution | Some valid KYC'd party received proof-verified payment | No |
| Spend/policy proof | Pass/fail only | No |
| Settlement | Generic transfer event | No |
| Credential revocation | Nullifier → public set | Yes |
| Device recovery | Share threshold coordination | Processor review if cloud share |

---

## 3. Data classification & retention

| Class | Examples | Where | Retention |
|---|---|---|---|
| **0** | Voice, raw ID, plaintext contacts/balance/policy | Device only | Never transmitted |
| **1** | Commitments, nullifiers | Midnight public state | Indefinite (integrity); one-way, no PII |
| **2** | Pass/fail, jurisdiction, sanctions timestamp | KYC Issuance | Per AML regime (placeholder 5y) |
| **3** | Relay timestamps, decoy counts | Settlement Relay | 24–72h (configured 48h), then purged |

**Principle:** never hold Class 0-equivalent content and a durable per-user identifier at the same time.

---

## 4. Regulatory mapping (KYC/AML)

- **Identity verification** — government-first ZK-KYC; system consumes issuer result.
- **Sanctions** — `sanctions_clear` in credential leaf; re-screened on cadence; stale → revoke.
- **Recordkeeping** — Class 2 only place regulator finds who/when verified.
- **SAR/STR** — no default TX-level path. Options: (1) scope product under threshold, or (2) selective disclosure (view-key / auditor-proof under lawful order).
- **Revocation** — AML enforcement lever without revealing past history.

---

## 5. Privacy-law mapping

- Minimization maps to DPDP / GDPR by construction.
- Erasure: Class 0 = local delete; Class 2 vs AML retention must be disclosed.
- Cross-border: applies to Class 2 transfers.
- Recovery cloud share = processor → DPA required even if share is inert alone.

---

## 6. Security controls

| Threat | Control |
|---|---|
| Credential fraud post-issuance | Nullifier revocation |
| Contact spoofing | Recipient self-signature at enrollment |
| Device loss | Threshold vault |
| Timing analysis | Jittered relay + decoys (mitigation, not proof) |
| On-device compromise | Out of crypto scope |
| Double-spend | Nullifier set |
| Replay | Nonce binding |

---

## 7. Gaps to disclose (not paper over)

1. **No default SAR/STR path** — open; needs scoping or selective disclosure.
2. **Sanctions staleness** — mitigated by operational re-screen + revoke.
3. **Recovery-vault processor** — disclosed; DPA paperwork required.
4. **Erasure vs AML** — disclosed; resolve per jurisdiction in privacy policy.

---

## API surface

| Endpoint | Role |
|---|---|
| `GET /api/compliance` | Full machine-readable document |
| `GET /api/compliance/audit-report` | Public-state aggregates only |
| `GET /api/compliance/relay` | Class 3 relay stats |
| `GET /api/compliance/revocations` | Revocation public set stats |
| `GET /api/compliance/recovery-processor` | DPA disclosure |
| `POST /api/compliance/sanctions/rescreen` | Operational re-screen |
| `POST /api/compliance/enrollment/begin\|complete` | Stateless handshake |
| `POST /api/users/:id/view-key` | Issue view-key commitment (SAR path 2) |
| `POST /api/users/:id/auditor-proof` | Compelled selective disclosure |
| `POST /api/kyc/revoke` | Nullifier revocation |
| `POST /api/register` | Issuance → Registry Writer |
| `POST /api/users/:id/confirm` | Proof Verification → Settlement Relay |
