# Launch checklist — capped pilot

Use with [PRODUCTION.md](./PRODUCTION.md), [COMPLIANCE.md](./COMPLIANCE.md), [THREAT_MODEL.md](./THREAT_MODEL.md).

## Asset truth (say this out loud)

- **CIRCLE units** — Class 0 product balance on the device vault; Compact commitments on Midnight.
- **tDUST** — optional Preprod network fees for on-chain broadcast only.
- **Not** INR ACH / UPI / card / USDC until a licensed rail is wired behind `RailAdapter`.

## Pre-flight (fail-closed)

- [ ] `MERCHANT_KEK`, `COMPACT_LOCAL_SK`, `API_SKILL_TOKEN`, `MIDNIGHT_PROOF_SERVER_URL`, `CORS_ORIGIN` set
- [ ] `NYXPAY_ALLOW_DEMO_SEED` and `NYXPAY_ALLOW_STUB_RAILS` **unset** in production
- [ ] `npm run start:prod` boots (or refuses with a clear missing-secret error)
- [ ] `GET /api/health` → `proofMode.mode = midnight-proof-server`, `proofServerOk: true`
- [ ] `GET /api/rails` shows `internal_ledger` as `live_pilot`; UPI/card as `adapter_stub`

## Product path

- [ ] Create wallet → verify identity (sandbox KYC) → add money → add recipient → pay → receipt
- [ ] Systems Theater / demo hub only behind showcase menu
- [ ] Failure UX: proof-server down, risk hold, revoked KYC, stale commitment, Repair vault

## Ops

- [ ] `GET /api/ops/metrics` and `GET /api/compliance/ops` monitored daily
- [ ] `GET /api/compliance/audit-export` retained per counsel
- [ ] Sanctions rescreen job scheduled (`POST /api/compliance/sanctions/rescreen`)
- [ ] Payment lifecycle reconciliation: open gaps → 0 overnight
- [ ] Disputes / refunds: Insights → Dispute (pilot auto-refund on internal ledger)

## Security

- [ ] Secrets in KMS/HSM (not `.env` on disk long-term)
- [ ] Dependency audit + secret scan + CSP review
- [ ] Pen-test of vault, recovery, proof boundaries (see THREAT_MODEL.md)
- [ ] Privacy policy + terms + legal review before real money

## Verification commands

```bash
npm test
npm run build
npm run judge:smoke
# Manual gold path:
npm run judge   # then follow JUDGE.md
```

## In-repo production stretch (still pilot)

- [ ] `KYC_PROVIDER=onfido_shaped` (shaped issuer — not live DigiLocker/Onfido)
- [ ] `sandbox_psp` rail + HMAC `POST /api/rails/sandbox_psp/webhook`
- [ ] Settings → Enroll vault passkey (high-value biometric)
- [ ] Settings → Privacy / Terms
- [ ] `npm run verify` (= test + build + judge:smoke)
- [ ] `npm run audit:ci`

## Universal adapter gates (capped pilot)

- [ ] Mock/stub rails disabled (`NYXPAY_ALLOW_STUB_RAILS` unset in prod)
- [ ] Stripe TEST enabled: `STRIPE_SECRET_KEY=sk_test_…` **or** `NYXPAY_UNIVERSAL_LOCAL_STRIPE=1`
- [ ] Sandbox PSP enabled (`sandbox_psp` HMAC webhook) for source debit leg
- [ ] `KYC_PROVIDER=onfido_shaped` (shaped issuer — not live DigiLocker; required by strict boot)
- [ ] KYC/sanctions clear for Maya/Arjun (`GET /api/universal/sandbox-accounts`)
- [ ] Route compliance before settle (`INR→USD` challenge / `INR→BTC` enhanced KYC)
- [ ] Strict ZK: `NYXPAY_REQUIRE_ZK_PROVE=1` + proof-server healthy
- [ ] Universal settle runs **rail adapters** (source → FX → Stripe TEST target) after ZK prove
- [ ] Recon gap count = 0 (`GET /api/ops/universal` → `metrics.pendingReconciliation`)
- [ ] Refund via rails (`POST /api/universal/refund` → Stripe/PSP refund)
- [ ] Reconcile endpoint (`POST /api/universal/reconcile`)
- [ ] Ops: `GET /api/ops/universal` shows `stripeTest.mode` + sandbox_psp
- [ ] Tamper-route rejection (route commitment mismatch)
- [ ] Disputes / manual_review support path
- [ ] Privacy/Terms explain rails + conversion
- [ ] E2E: `npm run test:e2e` (+ optional `npm run test:e2e:playwright`)
- [ ] Boot: `npm run start:prod` (local Stripe ledger) or `start:prod:stripe` with `sk_test_`

## Explicit non-goals for v1 pilot (cannot fake a 10/10 with code alone)

- Licensed UPI/bank/card acquisition
- Live DigiLocker/Onfido production KYC API
- Formal third-party crypto audit sign-off
- App Store / Play production submission (Capacitor shell only)
- Money transmitter / banking license
