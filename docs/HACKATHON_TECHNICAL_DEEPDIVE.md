# Hackathon technical deep dive — Universal Adapter

Map every demo claim to code. Judges can verify bold claims in under two minutes.

## Claim → code

| Demo claim | Code |
|---|---|
| Universal demo UI | `src/screens/UniversalAdapterDemo.tsx` |
| Judge command center | `src/screens/JudgeCommandCenter.tsx` → `GET /api/judge/command-center` |
| Sandbox accounts (Maya/Arjun) | `server/services/sandboxAccounts.ts` → `GET /api/universal/sandbox-accounts` |
| Durable universal store | `store.universal` via `universalPersist.ts` + `bindUniversalStore` |
| Hard compliance on settle | `assertSettleCompliance` → `403 Settle blocked` until `…/verify` |
| Quote / route / settle | `server/services/universalService.ts` → `POST /api/universal/{quote,route,sandbox-settle}` |
| Quote engine | `server/services/quoteEngine.ts` |
| Route planner | `server/services/routePlanner.ts` |
| FX rail | `server/txAuth/rails/mockFx.ts` |
| Sandbox PSP (source) | `server/txAuth/rails/sandboxPsp.ts` |
| Stripe TEST (target) | `server/txAuth/rails/stripeTest.ts` |
| Proof server / ZK grade | `server/services/proofServer.ts` (`attestUniversalRouteBinding`) |
| Lifecycle (P2P + universal) | `server/services/paymentLifecycle.ts` |
| Asset registry | `server/services/assetRegistry.ts` → `GET /api/assets` |
| Payment methods | `server/services/paymentMethodRegistry.ts` → `GET /api/payment-methods` |
| Redaction / metrics | `server/services/observability.ts` → `GET /api/ops/metrics`, `GET /api/ops/universal` |
| Compact circuits | `contracts/nyxpay.compact` |
| Frozen judge script | [JUDGE.md](../JUDGE.md) |

## API surface (demo + pilot)

```text
GET  /api/assets
GET  /api/payment-methods
GET  /api/universal/sandbox-accounts
POST /api/universal/sandbox-accounts
GET  /api/universal/route-cards
POST /api/universal/quote
POST /api/universal/route
POST /api/universal/sandbox-settle   # alias: POST /api/universal/settle
GET  /api/universal/payments/:id
GET  /api/universal/receipt/:id
POST /api/universal/refund
POST /api/universal/reconcile
GET  /api/ops/universal
GET  /api/judge/command-center
```

## Visible IDs judges should see

After **Run judge demo** or Confirm settle:

- `quoteId` · `routeId` · `routeCommitment`
- `sourceAdapter` · `conversionAdapter` · `targetAdapter`
- `proofMode` · `attestationGrade`
- `receiptId` · `lifecycleState`
- Ops: `settled` · `failed` · `refunds` · `tamperRejects`

## Proof binding (RouteProof / ZK-proven)

`routeCommitment = sha256(uni:route | …)`  
`intentCommitment = sha256(uni:intent | routeCommitment | quoteId | routeId | sender | receiver | amount | target | expiry)`

On settle, `attestUniversalRouteBinding` (`proofServer.ts`):

1. Compact `prove_authorized_transaction` with public inputs derived from the bind  
2. Midnight proof-server `/prove` when healthy  
3. Grade = **`zk-proved` only if SNARK bytes return** (never inferred from health alone)

Settle rejects before prove:

- wrong `routeCommitment`
- `tamperRouteId` ≠ confirmed `routeId` → **route commitment mismatch**

## Route matrix

| Card | Readiness |
|---|---|
| INR → USD | sandbox (sandbox_psp → mock_fx → stripe_test) |
| INR → BTC | sandbox (sandbox path + preferred asset BTC) |
| INR → CIRCLE | live_pilot (internal_ledger) |
| CIRCLE → USD | demo-only |

## Honest boundaries

- INR is **not** native on Midnight.
- USD/BTC credits are **sandbox**, not licensed bank/UPI/mainnet.
- Gold SNARK path needs Docker proof-server; else compact-runtime with clear label.
- Strict production (`NYXPAY_REQUIRE_ZK_PROVE=1`) fails closed without proof-server.

## Frozen judge script

See [JUDGE.md](../JUDGE.md) — official 3-minute path: Real vs demo → Universal Adapter → Tamper → Gold ZK voice pay.
