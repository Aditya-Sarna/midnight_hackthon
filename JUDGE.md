# Circle — Judge demo script (≈3 minutes)

**Product name:** Circle  
**Gold path:** Compact ledger + Midnight proof-server SNARKs (`grade: zk-proved`).  
**Differentiator:** RouteProof — quote + route + receiver preference + target asset are cryptographically bound; tampering is visibly rejected.

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

## Official 3-minute path (freeze this)

### 1. Real vs demo boundary (≈30s)

- Open **Real vs demo**.
- Say what is **live** (Compact + proof-server SNARKs), **sandbox** (Stripe TEST / sandbox PSP + FX), and **future provider work** (licensed UPI/bank — not claimed).

### 2. Universal Adapter (≈90s)

- Open **Universal adapter**.
- Click **Run judge demo** (or speak/type: “Send 5000 to Maya”).
- Show **INR sender → USD receiver**.
- Point at backend **quote**, **route**, **receipt**, and proof metadata on the phones / IDs line.
- Optionally open **Command center** — technical receipt: `quoteId`, `routeId`, `routeCommitment`, `receiptId`, adapters, `proofMode`, `attestationGrade`.

### 3. Tamper rejection (≈30s)

- Click **Try tamper route**.
- Show `route commitment mismatch` (or equivalent rejection).
- Say: “The user authorized USD; the router cannot silently switch to BTC.”
- Point at the **RouteProof binds** panel: tamper USD → BTC → **rejected**.

### 4. Gold ZK path (≈30s)

- Open **Guided tour** (or voice pay on home).
- Complete payment.
- Show **`grade: zk-proved`**.

## Pitch (10 seconds)

> Circle is an OTP replacement and private payment layer on Midnight. Users speak a payment intent; the device keeps balances and openings private; the public ledger only receives commitments, nullifiers, and proofs. RouteProof binds the authorized conversion path so a router cannot silently change the target asset.

## What must appear

- [ ] Real vs demo: live / sandbox / future boundary clear  
- [ ] Universal Adapter: INR → USD (Maya), quote/route/receipt visible  
- [ ] Tamper: `route commitment mismatch`  
- [ ] Command center: technical receipt fields  
- [ ] Settle grade: **`zk-proved`** on gold voice path  
- [ ] No claim of licensed UPI/bank  

## Honest lines

| Topic | Say |
|---|---|
| Voice | “Browser Web Speech captures the utterance; payment secrets and ZK proofs stay on device.” |
| Amounts | “Public ledger never sees amounts; the prover uses private witnesses to build SNARKs.” |
| RouteProof | “Quote, route, sender, receiver, assets, and acceptance preference are bound; tamper fails closed.” |
| Money | “Sandbox Stripe TEST / PSP for conversion demo — not licensed bank rails.” |

## Fallback if proof-server fails

- Show **compact-runtime** on Real vs demo / command center.
- Say: “SNARK path requires Docker proof-server.”
- Continue Universal Adapter + tamper story (still API-backed).

## Brand

**Circle** — private voice agentic payments on Midnight. Distinct from Circle Internet Financial / USDC.
