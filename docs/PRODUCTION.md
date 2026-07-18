# Circled production readiness

## Security model

| Layer | Guarantee |
|---|---|
| Class 0 vault | Non-extractable AES-GCM wrap key in IndexedDB; vault blob sealed at rest; legacy hex wrap keys migrated + deleted |
| Signing keys | ECDSA/ECDH **private keys are non-extractable CryptoKeys in IndexedDB** (`circled_keystore_v1`); vault JSON stores public material only; CSP blocks inline script XSS |
| Voice settle | ASR never settles alone — human Accept required; high-value needs second confirm; **production blocks unknown contacts** (enroll first) |
| ASR hygiene | Hinglish trailers stripped; garbage contacts (`… bhej dijiye`) purged on vault load; never re-enrolled |
| Policy privacy | `prove_policy_update` is a **real SNARK circuit** (`proof: true`) — amount is a private witness; included in settle `/prove` batch |
| Mobile install | Installable PWA (`manifest.webmanifest` + `sw.js` + Install prompt) + Capacitor (`npm run cap:ios` / `cap:android`) |
| Server store | Commitments / nullifiers only; merchant HMAC keys sealed with `MERCHANT_KEK` (`enc:v1:`) |
| Settle path | Compact-runtime required under `NYXPAY_REQUIRE_PROOFS`; structural-only rejected |
| ZK honesty | `zk-proved` only when recipient + spend + **policy** SNARKs return; warming keys alone never counts |
| Rails | Stub UPI/card/IBAN/PIX/crypto **blocked in strict** unless `NYXPAY_ALLOW_STUB_RAILS=1` |
| HTTP | Helmet CSP (incl. Web Speech), CORS allowlist, Redis-backed rate limits when `REDIS_URL` set, `API_SKILL_TOKEN` in production, bind `127.0.0.1` in strict |
| Demo surfaces | `/api/seed/peer` and demo merchant seed disabled in production unless `NYXPAY_ALLOW_DEMO_SEED=1` |

## Boot checklist

Strict boot **throws** if secrets are missing — no accidental ephemeral production listen.

```bash
cp .env.example .env
# Required for absolute production:
#   MERCHANT_KEK
#   COMPACT_LOCAL_SK
#   CORS_ORIGIN
#   API_SKILL_TOKEN
#   MIDNIGHT_PROOF_SERVER_URL=http://127.0.0.1:6300
# Optional: REDIS_URL, MIDNIGHT_WALLET_SEED (on-chain)

npm run compact:compile   # emits prove_policy_update keys
npm run proof-server:up   # midnight-proof-server
npm run start:prod        # fail-closed ZK + proofs

# Local judge demo (soft):
npm run start:soft        # ephemeral secrets + stub rails + ZK optional
```

## Attestation grades

| Grade | Meaning | Allowed in `start:prod`? |
|---|---|---|
| `zk-proved` | Compact executed **and** proof-server `/prove` returned SNARKs for recipient + spend + policy | Yes (required) |
| `compact-runtime` | Compiled circuits executed via compact-runtime only | Soft/demo only |
| `structural` | Client transcript only | **No** |
| `rejected` | Failed checks | No |

`proved: true` is set **only** for `zk-proved`.

## Agent skills

- `verified-merchant-payment` — destination ownership binding
- `rail-agnostic-tx-auth` — intent commitment authorization

Both seal merchant secrets at rest. Stub settlement rails are **fail-closed** under strict production.

See [ENTERPRISE.md](./ENTERPRISE.md) · [CONTRACT_UPGRADE.md](./CONTRACT_UPGRADE.md).
