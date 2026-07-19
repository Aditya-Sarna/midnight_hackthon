# CircleProof — threat model (pilot)

Scope: device Class 0 vault, Compact ledger, Midnight proof-server, browser client, Express API.

## Assets

| Asset | Class | Location |
|---|---|---|
| Signing / ECDH keys | 0 | IndexedDB non-extractable CryptoKeys |
| Balance openings, contacts, history | 0 | AES-GCM vault ciphertext (wrap key in IDB) |
| Recovery kit | 0 (sealed) | User-held file; optional threshold cloud wrap |
| Document reference | 0 → hash | Hashed on device before register |
| Compact witnesses (amounts) | ephemeral | Sent to prover host for SNARK |
| Commitments / nullifiers | 1 | Public Compact / Midnight state |
| KYC pass/fail, jurisdiction | 2 | API store + audit log |

## Trust boundaries

1. **Device** — Class 0 never leaves except as wrap-encrypted kit or prover witnesses.
2. **API / compliance** — commitments, Class 2 metadata, dispute records; no plaintext balances.
3. **Proof-server** — receives witnesses including amounts; must be treated as trusted compute for SNARK generation.
4. **Browser Web Speech** — may use cloud STT; not inside the Class 0 boundary.
5. **Rail adapters** — edge settlement only after Compact / CircleProof authorization.

## Threats & controls

| Threat | Control | Residual |
|---|---|---|
| Stolen laptop with unlocked session | WebAuthn unlock TTL; wrap key in IDB | User must lock OS / revoke kit |
| Stolen recovery kit file | Passphrase (PBKDF2 310k) | Weak passphrase → kit compromise |
| Malicious prover | Operational trust + future TEE / self-host | Amounts visible to prover today |
| Replay spend | Nullifiers + session challenge burn | — |
| Stale sanctions | `SANCTIONS_RESCREEN_MS` + `/api/compliance/ops` | Needs live list provider |
| Fake merchant | Verified-merchant Compact skill | Pilot brand registry |
| Mistaken pay | Dispute API + on-device refund after approval | No chargeback network yet |
| Silent route switch (USD→BTC) | RouteProof: `routeCommitment` bind + settle reject on tamper | Needs judge-visible demo + ops counters |
| Quote / commitment replay | Quote single-use after settle; nullifiers / session burn | In-memory universal store until durable persist |
| Provider secret / PII leak | Redacted logs (`observability.ts`); opaque destination IDs | Never log card/bank/wallet; audit responses |
| Supply-chain / XSS | CSP via helmet; no secrets in JS bundles | Audit still required for real funds |

## Explicit non-goals (until audit + license)

- Holding customer fiat under a banking license
- Claiming STT is private
- Claiming prover never sees amounts
- Production SAR filing without selective-disclosure legal process

## Audit checklist (pre-real-funds)

- [ ] External review of Compact circuits + witness surface
- [ ] IDB keystore / wrap-key extraction tests
- [ ] Recovery kit misuse scenarios
- [ ] Proof-server deployment hardening
- [ ] Pentest of `/confirm`, `/register`, dispute + offramp stubs
