# Circled — Real Testnet Anchor (Raising the Realism Boundary)

## Purpose

Every settle in the universal adapter currently uses Stripe TEST plus mock
FX/UPI rails. That's honest, but it leaves one legitimate scrutiny point:
"you never actually touch a real chain." This document specifies the
minimum credible fix — **a real, live, public-testnet block anchor bound
into every settle receipt** — without requiring a funded key or a
broadcastable transaction.

**Core design commitment carried through this document:** we never claim
to move real value on a real chain. We do prove that at settle time we
were in live communication with a real, external, publicly-verifiable
testnet, and we bind that proof into the receipt so anyone can
independently re-fetch and verify.

## 0. Live settlement transaction tier

When `NYXPAY_UNIVERSAL_TESTNET_TX=1`, a completed universal settlement submits
a unique Midnight Preprod transaction after proof and both rail legs succeed.
The submitted payload anchors a digest over the intent commitment, route
commitment, source and target settlement IDs, and proof binding digest.

The durable receipt records:

```text
onchainSettlement.network
onchainSettlement.txHash
onchainSettlement.txKind
onchainSettlement.settlementId
onchainSettlement.settlementBinding
onchainSettlement.receiptBinding
```

`receiptBinding` commits to the settlement binding, anchored settlement ID,
network, and returned transaction hash. A tx hash is displayed only when the
wallet submitter returned `submitted`; configured-but-unavailable submission is
recorded as `onchain_settlement_missing`, never replaced with an old deployment
or faucet transaction.

Set `NYXPAY_UNIVERSAL_REQUIRE_TESTNET_TX=1` for a rehearsal that must fail unless
a genuine transaction hash is returned. In this mode refundable rail legs are
reversed before the API returns the failure.

---

## 1. Why "just add a real transfer" is not the right first step

The tempting naive fix — wire up a funded Sepolia key, send real USDC on
every settle — fails on three axes at once:

1. **It introduces custody.** Any funded testnet key on a demo server
   creates a soft-custody surface that the rest of the design has
   explicitly avoided at every other layer.
2. **It's brittle.** Public faucets throttle; keys drain; a hackathon
   demo that depends on a live funded balance is one dry faucet away
   from a failed judge run.
3. **It doesn't answer the actual question.** The question isn't "did
   USDC move" — it's "is this system in real contact with a real chain
   or is it just simulating one." A signed, timestamped, live block
   anchor answers that at least as well as a transaction receipt, and
   costs zero.

So the actual problem is not "broadcast" — it's "prove liveness and bind
to a real external source of randomness / time." Those are separable, and
only the second one is on the critical path for realism.

---

## 2. Testnet witness (live block anchor, no funded key)

### 2.1 Design: real JSON-RPC read against a public Sepolia endpoint

```
Circuit boundary (unchanged):
  intent_commitment = sha256(route_commitment | quote_id | route_id | …)

Realism layer (new, additive):
  On every settle, before returning the receipt:
    witness = fetch_sepolia_head()   // JSON-RPC eth_getBlockByNumber("latest")
    witness_binding = sha256(intent_commitment | witness.blockHash |
                             witness.blockNumber | witness.chainId)
    receipt.testnet_witness = {
      chain: "ethereum-sepolia",
      chainId: 11155111,
      blockNumber: witness.blockNumber,
      blockHash: witness.blockHash,
      observedAt: now,
      binding: witness_binding,
      source: "https://ethereum-sepolia.publicnode.com"
    }
```

Any judge can independently `curl` the same public endpoint at
`witness.blockHash` and confirm the block exists, has that number, and
has that timestamp. Nothing in the demo needs to be trusted.

### 2.2 Why this beats "one real transfer"

* **Reproducible.** The same JSON-RPC call works every time the demo
  runs. No faucet dependency, no key management, no per-run cost.
* **Cryptographically bound.** `witness_binding` glues the witness into
  the settle's intent commitment — a judge can verify the receipt was
  produced *after* observing that block, not backfilled.
* **Honest.** The receipt says "witnessed" not "settled" — it never
  overclaims that value moved on-chain.

### 2.3 Failure mode is a first-class case

The public RPC endpoint can be unavailable — that must not brick settle:

```
witness = try fetch_sepolia_head() catch => null

if witness == null:
  receipt.testnet_witness = { status: "unavailable",
                              attemptedAt: now,
                              source: "…" }
  receipt.reconciliation_gaps.push("testnet_witness_missing")
```

Reconciliation surfaces the gap; the settle itself still completes with
its existing proof + rail guarantees. This is the same discipline as the
existing `webhook_missing` gap — visible, not hidden.

---

## 3. Optional next tier — unsigned broadcast envelope (documented, not built here)

For a future funded-key upgrade, the same witness binding structure
extends cleanly:

```
receipt.testnet_broadcast = {
  chain: "ethereum-sepolia",
  contract: "0x…USDC",          // real Sepolia USDC contract
  amount: "…",
  destination: "0x…",
  unsignedTx: "0x…",             // built, not sent
  intentBinding: witness_binding
}
```

If someone later funds a signer, `unsignedTx` becomes signable and
broadcastable without changing anything above it. This document does not
require that step — it's called out only so the shape is compatible.

---

## 4. Threat model

| Threat | Mitigation |
|---|---|
| Public RPC returns a fake / stale block to make us look "live" | `blockHash` is verifiable by any third party against any independent Sepolia RPC — a judge can cross-check in 1 curl |
| Server backfills a witness from an old block after settle to look faster than it was | `witness.observedAt` and `witness_binding` are locked into the receipt at settle time; changing them changes the intent commitment, which the SNARK covers |
| Public RPC endpoint goes down mid-demo | §2.3 — settle still completes, receipt carries `witness_unavailable` gap, reconciliation surfaces it — same discipline as `webhook_missing` |
| Judge asks "did money move?" and misreads witness as a transfer | Receipt field is named `testnet_witness` not `testnet_settlement`; UI labels it "Sepolia block anchor · no value moved"; docs explicitly say "we did not broadcast" |
| Someone points at this and calls it security theater | It isn't a security claim — it's a liveness claim, and it's independently verifiable; the SNARK still does the actual proof work |

---

## 5. Scaling / operational note

A naive per-settle round-trip to a public RPC is fine at demo scale
(~one call per settle, sub-second) but wrong at pilot scale — it makes
settle latency dependent on an external free-tier endpoint. At pilot
scale this reuses the same discipline as the rest of the observability
layer:

* Cache the latest head for `N` seconds (default 5s) — any settle within
  that window binds to the cached head. Freshness bound is explicit in
  the receipt (`observedAt`).
* Pin an internal Sepolia archive node once real volume is a concern —
  same interface, same binding, no code change above the fetcher.
* Add a second, independent endpoint (e.g. Alchemy free tier) and
  require both to agree on `blockHash` before binding — cheap upgrade,
  eliminates single-source trust.

The endpoint pinning step is called out as a real engineering item for
pilot, not solved in this document, same way the credit module flagged
`prove_pool_solvency` as new work.
