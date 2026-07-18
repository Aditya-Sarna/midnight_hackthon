# Circled — Confidential Voice Payments on Midnight

**v5.0 Production:** Class 0 secrets never leave the device (non-extractable IndexedDB wrap key). Payments settle through **compiled Compact circuits** (`compactc` 0.31.1 + `compact-runtime`). Merchant secrets sealed at rest. Strict mode fail-closes structural-only settle. See `docs/PRODUCTION.md`.

## Quick start

```bash
export PATH="$HOME/.local/node-v22.15.0-darwin-arm64/bin:$PATH"  # if needed
npm install
cp .env.example .env   # set MERCHANT_KEK + COMPACT_LOCAL_SK for production
npm run compact:compile   # if contracts/managed/nyxpay is missing
npm run dev
```

- App: http://localhost:5173  
- API: http://localhost:8787  
- Compact: `contracts/nyxpay.compact` → `contracts/managed/nyxpay/`
- Docs: `docs/PRODUCTION.md` · `docs/COMPACT.md` · `docs/NYXPROOF.md` · `docs/COMPLIANCE.md`  
Skills: verified-merchant-payment · rail-agnostic-tx-auth · **receiving-payment** (`prove_credit_update`)

### Proof server (elevates to live `/prove`)

```bash
# Docker Desktop must be running
npm run proof-server:up
```

| `proofMode.mode` | Meaning |
|---|---|
| `compact-runtime` | compactc artifacts + real Compact ledger execution |
| `midnight-proof-server` | + local proof-server — settle produces real `/prove` SNARKs (`grade: zk-proved`) |
| `compact-sim` | artifacts missing (rejected under `NYXPAY_STRICT`) |

### Preprod on-chain

Fund a wallet via the [Preprod faucet](https://faucet.preprod.midnight.network), then:

```bash
export MIDNIGHT_WALLET_SEED=<hex>
export MIDNIGHT_CONTRACT_ADDRESS=<deployed>
```

See `docs/COMPACT.md`.

## Demonstration

1. **Launch production demonstration**
2. Device provisions Class 0 vault (ECDSA + ECDH keys, balance, policy)
3. ZK theater → iPhone home → tap Circled → say amount and name → Accept
4. Confirm runs CircledProof `prove_session_auth` + Compact `prove_spend_update` — server never sees amounts

## Production architecture

| Layer | Holds |
|---|---|
| **Device vault** (AES-GCM + non-extractable wrap key) | privateKey, balance, openings, contacts, policy params |
| **Backend** | pubkey, commitments, nullifiers, encrypted notes, sealed merchant secrets |
| **Compact ledger** (`data/compact-ledger.json`) | Real circuit state: KYC root, spend/transfer/challenge counters |
| **Midnight Preprod** | Indexer/node health; optional on-chain submit when wallet configured |

Production start: `npm start` (`NYXPAY_STRICT=1`). Soft demo prod: `npm run start:soft`.

Auth is **ECDSA P-256** — server verifies with the registered public key and never holds a signing secret.

## API highlights

| Endpoint | Role |
|---|---|
| `GET /api/health` | Midnight + proofMode + compactLedger + onchain |
| `GET /api/compact/ledger` | Compact runtime counters |
| `POST /api/users/:id/confirm` | CircledProof + Compact settle |
| `GET /api/compliance` | Compliance posture |
| `GET /api/nyxproof` | OTP-replacement spec |
