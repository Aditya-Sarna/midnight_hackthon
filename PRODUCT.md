# CircleProof — product runbook

**CircleProof** is the product / protocol name (OTP replacement + private pay on Midnight). The home-screen **widget** still brands as Circle for the consumer shell.

People pay from a small widget — no need to open a full banking app for everyday spends.

Showcase / judge destinations stay on the cinema menu. They are opt-in only.

## What users get today

1. Open the app → cinema intro → welcome beats → **menu**.
2. Tap **Circle** → **Create account** (or **Restore from recovery kit**).
3. Set a **recovery passphrase** — a kit file downloads automatically (not BIP39).
4. **Add money** on the widget (wallets start at zero).
5. **Tap the widget** and speak amount + name — ZK proof, then Accept.
6. New names are saved on-device when you Accept.
7. Offline: balance/history stay readable; pay waits for the API.
8. If settle commits but the device fails to apply → **Repair vault**.
9. Sign out returns to the **menu**.

## Paths

| Path | How | Behavior |
|---|---|---|
| **Product** | Menu → **Circle** | `demoMode` off · gate → onboarding/restore · widget wallet · no Systems Theater |
| **Showcase** | Other menu rows / Settings → Showcase | Demo seed & judge chrome |
| **`?demo=1`** | URL | Showcase mode |

## Recovery (absolute)

| Piece | Behavior |
|---|---|
| Passphrase kit | AES-GCM blob with vault + private JWKs; PBKDF2 310k |
| Download | On signup + re-download from Settings → Social recovery |
| Restore | Gate → Restore, or Settings → Social recovery → Kit + passphrase |
| Cloud threshold | Optional enroll of the same kit; 3-of-5 share unwrap then passphrase |

## Run locally

```bash
npm install
cp .env.example .env
npm run proof-server:up
npm run dev
```

Then: Intro → Menu → **Circle** → Create account → Add money → speak pay.

```bash
npm run start:prod
```

## Asset model

**CIRCLE product units** on the Class 0 vault. Public ledger stores Compact balance commitments. Optional Preprod broadcast uses **tDUST** for fees. Not INR ACH, UPI, or USDC yet — see Settings → **Money rails & asset** and `GET /api/asset`.

## Pilot surfaces for “missing features”

| Gap | Pilot surface |
|---|---|
| Rails | Settings → Money rails · `GET /api/rails` · `internal_ledger` quote/reserve/settle/refund |
| Lifecycle | Durable payment states + `GET /api/users/:id/payments` receipts |
| Risk | Velocity / new-recipient / failed-proof gates before rail reserve |
| KYC provider | Sandbox issuer with liveness/doc flags + `kycAudit` · `GET /api/compliance/ops` |
| Disputes / refunds | Insights → Expenses → Dispute / refund |
| Observability | `GET /api/ops/metrics` · redacted structured settle logs |
| Threat model | [`docs/THREAT_MODEL.md`](docs/THREAT_MODEL.md) |
| Launch | [`docs/LAUNCH_CHECKLIST.md`](docs/LAUNCH_CHECKLIST.md) |
| Native | Capacitor App resume soft-locks vault; biometrics = WebAuthn passkeys |

## Honesty boundary

- Public ledger: commitments, nullifiers, roots — not plaintext balances.
- Class 0 on device: keys, openings, contacts, history.
- Prover host receives Compact witnesses (including amounts) to generate SNARKs. Do **not** claim “server never sees amounts.”
- Browser **Web Speech** may use cloud STT (e.g. Chrome → Google). Say: speech layer is the browser’s; payment secrets and proofs are local.
- Recovery kit is encrypted with **your** passphrase — the server never learns it.
- Add money is a product/testnet top-up rail that reseals the public balance commitment — not a bank ACH / UPI.
- Menu → **Real vs demo** is the one-screen judge truth panel (`proofMode`, grade, FAQ).
