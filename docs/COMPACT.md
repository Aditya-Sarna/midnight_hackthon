# Compact prove + settle (Circled)

## What's live now

| Layer | Status |
|-------|--------|
| `contracts/nyxpay.compact` | Source (pragma 0.23) |
| `compactc` 0.31.1 artifacts | `contracts/managed/nyxpay/` — keys, zkir, contract JS |
| Compact runtime settle | Every payment / CircledProof advances real Compact ledger counters |
| Proof-server `/prove` | When Docker proof-server is up → mode `midnight-proof-server` |
| Preprod broadcast | Needs `MIDNIGHT_WALLET_SEED` + `MIDNIGHT_CONTRACT_ADDRESS` + funded faucet |

## Commands

```bash
# Compile (already done in repo)
npm run compact:compile

# Proof server (requires Docker Desktop running)
npm run proof-server:up
# or: npm run proof-server

# Health
curl -s http://127.0.0.1:8787/api/health | python3 -m json.tool
curl -s http://127.0.0.1:8787/api/compact/ledger | python3 -m json.tool
```

## Modes (`proofMode.mode`)

1. **`compact-runtime`** — compactc artifacts loaded; circuits execute via `@midnight-ntwrk/compact-runtime` (this is the default when Docker is off).
2. **`midnight-proof-server`** — same + proof-server `:6300` healthy; prover/verifier keys loaded via `NodeZkConfigProvider`.
3. **`compact-sim`** — artifacts missing (should not happen after compile).

## On-chain Preprod

```bash
npm run proof-server:up          # mode → midnight-proof-server
npm run midnight:deploy          # prints unshielded address
```

1. Copy the printed `mn_addr_preprod1…` address into https://faucet.preprod.midnight.network/ (captcha required).
2. Re-run `npm run midnight:deploy` — submits DUST registration → `data/onchain-deployment.json` with `txId`.
3. Optional: full Compact `deployContract` once wallet sync completes.

Settlement always advances the Compact ledger in `data/compact-ledger.json`.
