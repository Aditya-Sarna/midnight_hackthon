# Circle — Judge demo script (≈3 minutes)

**Product name:** Circle  
**Scope:** confidential voice payments, session auth, Compact spend/credit, private strategy commitment, credit standing, universal adapter.  
**Gold path:** Compact ledger + Midnight proof-server SNARKs (`grade: zk-proved`).  
**Bonus:** Preprod on-chain when wallet + contract env are set.

## Pitch (10 seconds)

> Circle is an OTP replacement and private payment layer on Midnight. Users speak a payment intent; the device keeps balances, contacts, openings, and policy private; the public ledger only receives commitments, nullifiers, and proofs. Compact circuits verify spend, policy, recipient, and session auth. In the gold path, the proof-server returns real SNARKs — not a mock ZK animation.

## Before you open the laptop

```bash
npm install
cp .env.example .env
npm run judge          # starts proof-server + app
# optional check:
npm run judge:smoke
```

Confirm API health shows `proofMode.mode: "midnight-proof-server"` and `proofServerOk: true`:

```bash
curl -s http://127.0.0.1:8787/api/health | python3 -m json.tool
```

Open **Menu → Real vs demo** once before judges arrive — confirm Live status is gold.

## Timer

| Time | Do / say |
|---|---|
| **0:00** | “Circle is voice-first confidential payments on Midnight. No OTPs. No passwords.” |
| **0:20** | Click **See demo** → welcome beats (dog beat = “no OTP” punchline). |
| **0:45** | Menu → **Real vs demo** (5s). Point at `proofMode` + gold path checklist. |
| **1:00** | Menu → **Guided tour**. “Class 0 vault on device; ledger only sees commitments.” |
| **1:30** | Tour voice pay → Accept. “Circle session auth + Compact `prove_spend_update`.” |
| **2:00** | Success — call out **`zk-proved`** and circuit names on the strip / theater. |
| **2:25** | Optional: **Strategy** → Commit. “Private params → public commitment only.” |
| **2:50** | Close: “Balances stay private; proofs stay verifiable. Prover sees witnesses — public ledger does not.” |

## What must appear

- [ ] Header strip: `proofMode` / proof-server live  
- [ ] Settle grade: **`zk-proved`** (not only `compact-runtime`)  
- [ ] Systems Theater (showcase) shows Compact circuits  
- [ ] No claim that “server never sees amounts”  
- [ ] No claim that Web Speech is always on-device private  

## Honest lines (memorize)

| Topic | Say |
|---|---|
| Voice | “Browser Web Speech captures the utterance; payment secrets and ZK proofs stay on device.” |
| Amounts | “Public ledger never sees amounts; the prover uses private witnesses to build SNARKs.” |
| Midnight | “Compiled Compact + Midnight proof-server SNARKs. Preprod broadcast when wallet env is set.” |
| Money | “Device Class 0 balance in product units; Add money reseals the commitment — not bank ACH.” |
| Lost phone | “Recovery kit file + passphrase restores keys and vault.” |

## FAQ

**Is this on Midnight?**  
Yes — compiled Compact (`nyxpay.compact`) via `compact-runtime`, with live `/prove` SNARKs from the Midnight proof-server when Docker is up. Preprod broadcast is optional.

**Where do amounts live?**  
On the device vault as Class 0. Private witnesses when proving. Public Compact ledger: commitments and nullifiers only.

**Who sees the amount?**  
Not the public ledger. The prover host receives witnesses (including amounts) to generate SNARKs.

**Is voice fully private?**  
No — Chrome Web Speech may use Google’s STT. Secrets after intent parsing are local.

**What about trading strategies?**  
Private **strategy commitment** circuit: params never appear on the public ledger; only a commitment + proof.

**Brand?**  
**Circle** — private voice payments on Midnight. Distinct from Circle Internet Financial / USDC.

## Universal adapter freeze (≤3 minutes)

1. Start proof-server (`npm run judge` or `npm run proof-server:up`).
2. Run app (`npm run judge` / `npm run dev`).
3. Open **Real vs demo** — call out `proofMode` + gold path.
4. Open **Universal adapter**.
5. Send ₹5000 to **Maya** (USD) — Quote + route → Confirm settle. Point at `quoteId`, `routeId`, adapters, `receiptId`.
6. Send ₹5000 to **Arjun** (BTC) — same flow; show BTC target + `bitcoin_sandbox`.
7. Show **Intent commitment binds** list (quote/route/expiry/acceptance).
8. Press **Tamper route** — backend returns `route commitment mismatch`.
9. Open **Judge command center** — proof health, circuits, last receipt, lifecycle.
10. Finish with private **voice pay** gold path (`zk-proved`).

### Fallback if proof-server fails

- Show **compact-runtime** on Real vs demo / command center.
- Say: “SNARK path requires Docker proof-server.”
- Say: “Strict production mode would fail closed.”
- Continue universal sandbox settle for quote/route/lifecycle story.

## Fail-soft

If Docker/proof-server is down, `npm run dev` still demos Compact-runtime settle. Tell judges you are showing ledger execution; re-run `npm run judge` for SNARK grade. The Real vs demo panel will show mode clearly.
