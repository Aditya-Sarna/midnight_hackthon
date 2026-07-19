# Circle enterprise 10/10 posture

## 1. Compact constraints (not bind-only)

| Circuit | Enterprise guarantee |
|---|---|
| `prove_kyc_membership` | `HistoricMerkleTree` + `merkleTreePathRoot` path check |
| `prove_spend_update` | `old - amount = new` under `persistentCommit<Field>` |
| `prove_credit_update` | `old + amount = new` under `persistentCommit<Field>` |
| `publish_settlement_anchor` | Per-settlement on-ledger counter increment |

Device vault stores Class 0 `balanceOpening` and submits `balanceWitness` on settle.

## 2. Per-settlement Preprod submit

Each settle lands a **unique network `txId`**:

1. Prefer contract call `publish_settlement_anchor(settlement_id)` when `MIDNIGHT_CONTRACT_ADDRESS` / deploy file has a contract
2. Else unshielded self-transfer (unique fingerprint amount) via wallet SDK
3. Under `NYXPAY_REQUIRE_ONCHAIN` / strict: **fail closed** if live submit fails
4. Channel-anchored aliases (`deployTx:settle:…`) are **removed**; optional `NYXPAY_ALLOW_ANCHOR_FALLBACK=1` is dev-only and disabled when onchain is required

Ops: fund faucet → `npm run midnight:deploy` → proof-server up → settle

## 3. Live HSM appliance

```bash
MERCHANT_HSM_MASTER_KEY=$(openssl rand -hex 32) npm run hsm:appliance
# → http://127.0.0.1:9090

export MERCHANT_HSM_URL=http://127.0.0.1:9090
export NYXPAY_MERCHANT_SIGNING=external
curl -X POST "$MERCHANT_HSM_URL/keys/register" \
  -H 'content-type: application/json' \
  -d '{"merchant_identifier":"nike.com"}'
```

| Mode | Env |
|---|---|
| SoftHSM | `NYXPAY_MERCHANT_SIGNING=software` (demo) |
| Live appliance | `MERCHANT_HSM_URL` + `npm run hsm:appliance` |
| Strict | Auto-prove **off**; prefer external HSM |

Appliance endpoints: `/health` `/keys/register` `/sign` `/verify` — secrets never exported.
