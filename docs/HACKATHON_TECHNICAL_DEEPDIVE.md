# Hackathon technical deep dive — Universal Adapter

Map every demo claim to code. Judges can verify bold claims in under two minutes.

## Claim → code

| Demo claim | Code |
|---|---|
| Universal demo UI | `src/screens/UniversalAdapterDemo.tsx` |
| Judge command center | `src/screens/JudgeCommandCenter.tsx` → `GET /api/judge/command-center` |
| Asset registry | `server/services/assetRegistry.ts` → `GET /api/assets` |
| Payment methods | `server/services/paymentMethodRegistry.ts` → `GET /api/payment-methods` |
| Quote engine | `server/services/quoteEngine.ts` → `POST /api/universal/quote` |
| Route planner | `server/services/routePlanner.ts` → `POST /api/universal/route` |
| Sandbox accounts (Maya/Arjun) | `server/services/sandboxAccounts.ts` → `GET /api/universal/sandbox-accounts` |
| Universal settle + binding | `server/services/universalService.ts` → `POST /api/universal/sandbox-settle` |
| Lifecycle (P2P + universal fields) | `server/services/paymentLifecycle.ts` |
| Settlement proof / grade | `server/services/payments.ts`, `proofServer.ts` (`attestationGrade`) |
| Proof mode | `server/services/proofServer.ts` → health + settle |
| Redaction / metrics | `server/services/observability.ts` → `GET /api/ops/metrics`, `GET /api/ops/universal` |
| Real sandbox PSP rail | `server/txAuth/rails/sandboxPsp.ts` (HMAC webhook) |
| Compact circuits | `contracts/nyxpay.compact` |

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
GET  /api/ops/universal
GET  /api/judge/command-center
```

## Visible IDs judges should see

After Confirm sandbox settle:

- `quoteId` · `routeId` · `routeCommitment`
- `sourceAdapter` · `conversionAdapter` · `targetAdapter`
- `proofMode` · `attestationGrade`
- `receiptId` · `lifecycleState`

## Proof binding

`routeCommitment = sha256(uni:route | routeId | quoteId | sender | receiver | assets | amount | adapters | expiry)`

Settle rejects:

- wrong `routeCommitment`
- `tamperRouteId` ≠ confirmed `routeId` → **route commitment mismatch**

Intent commitment binds sender, receiver, amount, quoteId, routeId, expiry, target acceptance.

## Route matrix

| Card | Readiness |
|---|---|
| INR → USD | demo-only (bank_sandbox) |
| INR → BTC | demo-only (bitcoin_sandbox) |
| INR → CIRCLE | live_pilot (internal_ledger) |
| CIRCLE → USD | demo-only (bank_sandbox) |

## Honest boundaries

- INR is **not** native on Midnight.
- USD/BTC credits are **sandbox**, not licensed bank/UPI/mainnet.
- Gold SNARK path needs Docker proof-server; else compact-runtime with clear label.
- Strict production (`NYXPAY_REQUIRE_ZK_PROVE=1`) fails closed without proof-server.

## Frozen judge script

See [JUDGE.md](../JUDGE.md) § Universal adapter freeze.
