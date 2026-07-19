# Circle — Confidential Voice Payments on Midnight

Speak who to pay. Circle proves it — privately.

No OTPs. No passwords. Balances and strategy params stay off the public ledger; Compact circuits keep them mathematically verifiable.

**Product (default):** open the app → create account → wallet with balance, voice pay, history, contacts, settings. Session restores on refresh. Showcase cinema is opt-in (`?demo=1`). See [PRODUCT.md](PRODUCT.md).

## Product quick start

```bash
npm install
cp .env.example .env
npm run proof-server:up   # recommended
npm run dev               # http://localhost:5173
```

Production-shaped: `npm run start:prod`.

## Judge quick start (gold path)

Docker Desktop required for live SNARKs.

```bash
npm install
cp .env.example .env   # soft demo works with defaults
npm run judge          # proof-server up → app + API with SNARK settle
```

- App: http://localhost:5173  
- API: http://localhost:8787  
- **Demo script:** [JUDGE.md](JUDGE.md) (3-minute walkthrough)  
- Smoke: `npm run judge:smoke`

### Demo in four steps

1. Open the app → **See demo** → watch welcome → menu  
2. **Guided tour** (or Demo hub → Start guided judge tour)  
3. Voice pay → Accept → success  
4. Watch Systems Theater / Proof Theater for **`grade: zk-proved`**

### What judges should hear

| Claim | Truth |
|---|---|
| Public ledger | Sees commitments, nullifiers, roots — not plaintext balances or amounts |
| Class 0 vault | Keys, balance, openings, contacts stay on device |
| Prove path | Compact witnesses (including amounts) are used on the **prover host** to generate SNARKs |
| Gold settle | Local Compact ledger + Midnight **proof-server** `/prove` → `zk-proved` |
| Preprod | Optional bonus when `MIDNIGHT_WALLET_SEED` + contract are set |

## Proof modes

| `proofMode.mode` | Meaning |
|---|---|
| `compact-runtime` | compactc artifacts + real Compact ledger execution |
| `midnight-proof-server` | + local proof-server — settle produces real `/prove` SNARKs (`grade: zk-proved`) |
| `compact-sim` | artifacts missing (rejected under `NYXPAY_STRICT`) |

```bash
npm run proof-server:up    # Docker
npm run proof-server:down
```

## Architecture

| Layer | Holds |
|---|---|
| **Device vault** (AES-GCM + non-extractable wrap key) | privateKey, balance, openings, contacts, policy, strategy openings |
| **Backend** | pubkey, commitments, nullifiers, encrypted notes, sealed merchant secrets |
| **Compact ledger** (`data/compact-ledger.json`) | KYC root, spend/transfer/challenge/strategy counters |
| **Midnight Preprod** | Optional on-chain submit when wallet configured |

Auth is **ECDSA P-256** — server verifies with the registered public key and never holds a signing secret.

## Dev without SNARKs

```bash
npm run compact:compile   # if contracts/managed/nyxpay is missing
npm run dev               # compact-runtime settle (no Docker)
```

Production: `npm start` (`NYXPAY_STRICT=1`). Soft prod: `npm run start:soft`. Judge SNARK prod: `npm run start:prod`.

## Docs

| Doc | For |
|---|---|
| [PRODUCT.md](PRODUCT.md) | Ship / use as a product tomorrow |
| [JUDGE.md](JUDGE.md) | Timer script + FAQ |
| [docs/BUSINESS.md](docs/BUSINESS.md) | Pilot / GTM one-pager |
| [docs/COMPACT.md](docs/COMPACT.md) | Circuits + Preprod |
| [docs/PRODUCTION.md](docs/PRODUCTION.md) | Hardening |
| [docs/NYXPROOF.md](docs/NYXPROOF.md) | OTP-replacement session auth |
| [docs/COMPLIANCE.md](docs/COMPLIANCE.md) | Selective disclosure |

## API highlights

| Endpoint | Role |
|---|---|
| `GET /api/health` | Midnight + proofMode + compactLedger + onchain |
| `GET /api/compact/ledger` | Compact runtime counters |
| `POST /api/users/:id/confirm` | CircleProof + Compact settle |
| `POST /api/users/:id/strategy/commit` | Private strategy commitment |
| `GET /api/compliance` | Compliance posture |
| `GET /api/nyxproof` | OTP-replacement spec |

**For investors / partners:** [docs/BUSINESS.md](docs/BUSINESS.md)
