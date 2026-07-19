# Circle — Universal (Rail-Agnostic) Payment

One authorization layer above any rail. **Destination is opaque to the circuit.**

## Phases

| Phase | Status | Location |
|---|---|---|
| 1 Intent + commitment | Done | `server/txAuth/intent.ts`, `OpaqueDestination` |
| 2 `prove_authorized_transaction` | Done | Compact + `prover.ts` / `verifier.ts` |
| 3 Rail adapters | Done | `server/txAuth/rails/{crypto,upi,card,iban,pix}.ts` |
| 4 JIT mint | Done | `receivePay/mint.ts` → adapter.mintDestination |
| 5 Reconcile + unmatched | Done | `receivePay/reconcile.ts`, `GET …/unmatched` |
| 6 Settlement confirmation + buyer states | Done | `confirm.ts`, `buyerStatus.ts` |
| 7 Credit ↔ intent_commitment | Done | `creditDigest.ts` + `prove_credit_update` |
| 8 Cross-rail / new-rail test | Done | PIX + runtime Lightning in `universalPayment.test.ts` |

## Exit criterion (whole plan)

A rail that did not exist in the initial scope (e.g. PIX, Lightning) is added by writing **only an adapter**, with zero changes to circuit, registry, mint core, reconcile, or confirm.

## Ops

```bash
GET  /api/skills/rail-agnostic-tx-auth/rails
POST /api/skills/rail-agnostic-tx-auth/authorize
POST /api/skills/receiving-payment/receive
GET  /api/skills/receiving-payment/unmatched
POST /api/skills/receiving-payment/buyer-status
```
