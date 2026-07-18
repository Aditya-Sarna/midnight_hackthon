# Rail-Agnostic Transaction Authorization

Reference implementation of the a26z-Brand **intent authorization** skill for Circled.

## Deliverables map

| Spec item | Location |
|---|---|
| Merchant identity specification | `server/txAuth/types.ts` |
| Registry implementation | `server/txAuth/registry.ts` |
| Revocation service | `server/txAuth/revocation.ts` |
| Canonical intent + commitment | `server/txAuth/intent.ts` |
| Merchant authorization | `server/txAuth/merchantAuth.ts` |
| ZK circuit | `contracts/nyxpay.compact` (`prove_authorized_transaction`) |
| Proof generation | `server/txAuth/prover.ts` |
| Verification engine | `server/txAuth/verifier.ts` |
| Agent SDK | `src/lib/txAuthSdk.ts` |
| Challenge management | `server/txAuth/challenge.ts` |
| Registry sync | `server/txAuth/sync.ts` |
| Settlement interface | `server/txAuth/settlement.ts` |
| Observability | `server/txAuth/metrics.ts` |
| Security tests | `server/txAuth/txAuth.test.ts` |
| Cursor skill | `.cursor/skills/rail-agnostic-tx-auth/` |
| HTTP API | `GET/POST /api/skills/rail-agnostic-tx-auth/*` |

## End-to-end sequence

1. Build canonical transaction intent  
2. Generate `intent_commitment`  
3. Issue platform challenge  
4. Merchant signs commitment → `intent_signature`  
5. Prove `prove_authorized_transaction`  
6. Sync registry root + revocation accumulator  
7. Verify proof + challenge + intent binding  
8. Optionally route via abstract `SettlementRail`

## API quickstart

```bash
curl -s http://127.0.0.1:8787/api/skills/rail-agnostic-tx-auth/authorize \
  -H 'content-type: application/json' \
  -d '{
    "merchant_identifier": "nike.com",
    "order_reference": "ORD-1",
    "amount": 42,
    "currency": "USD",
    "settlement_rail": "midnight",
    "settlement_destination": "mn_shielded_demo",
    "settle": true
  }' | python3 -m json.tool
```
