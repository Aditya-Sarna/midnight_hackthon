# Circled — Backend-Authoritative Sandbox Ledger (Trust Surface)

## Purpose

The universal adapter demo does real work on the backend — real
proof-server SNARKs, real rail adapters (Stripe TEST / mock FX / mock
UPI), real route-commitment binding, real reconciliation. But sender
INR balance and receiver USD/BTC balance were tracked in React
`useState` on top of that real pipeline. A sharp judge who probes "where
is the real boundary" would find that boundary in the wrong place —
inside a browser, not inside the server.

This document specifies moving the sandbox ledger fully to the server:
the browser becomes a viewer of authoritative state, never its source.

**Core design commitment carried through this document:** the browser
never owns money state. Any balance shown in the UI is the last value
the server returned. The demo can still call itself "sandbox" — but the
sandbox itself is server-owned, persisted, and auditable, the same way
the rest of the system is.

---

## 1. Why UI-simulated balances are the wrong shape

The temptation was that "it's just a demo — client state is fine." Three
problems with that:

1. **The proof/rail pipeline is server-side and honest** — moving
   balances to the client creates two systems of record that can
   silently disagree. A refund path that succeeds on the rail but fails
   in the browser (or vice versa) looks correct at each end and wrong
   overall.
2. **It's exactly the kind of shortcut a pilot claim can't survive.**
   The moment anyone asks "would this survive a page refresh," a
   client-state demo either loses its history or reveals it was fake.
3. **It contradicts the design commitment elsewhere in the system.** The
   universal service already owns route commitments, quotes, rail
   settlements, and reconciliation gaps in a durable store. Balances are
   the one thing that was still in the browser — inconsistent for no
   reason.

So the actual problem is not "add a fetch call." The problem is
**making the server the single source of truth for sandbox money state,
and giving the UI a small, well-defined viewer contract on top of it.**

---

## 2. Sandbox ledger (server-owned, persisted, addressable)

### 2.1 Shape

```
SandboxLedger (server-side, persisted in universal bucket):
  senders:   Map<sender_id, { display_name, jurisdiction, asset,
                              balance, opening_balance }>
  receivers: Map<account_id, { balance }>       // keyed on sandbox account

Operations (server-only):
  debit_sender(sender_id, amount)      -> new balance, or throws
  credit_receiver(account_id, amount)  -> new balance
  reverse(sender_id, account_id, sender_amount, receiver_amount)
  reset()                              -> restores opening balances
```

The ledger is durable in the same store bucket as universal quotes,
routes, and payments — it survives process restart, so a judge can close
the tab, reopen it, and see the same balance state.

### 2.2 Wire into settle / refund

```
settleUniversal(...):
  ...existing proof + compliance + rail settlement...
  ledger.debit_sender(intent.sender_id, quote.source_amount)
  ledger.credit_receiver(route.account_id, quote.target_amount)
  persist()

refundUniversal(payment_id):
  ...existing rail refund path...
  ledger.reverse(payment.sender_id, payment.account_id,
                 payment.source_amount, payment.target_amount)
  persist()
```

The balance change is inside the same transaction as the rail settle —
if the rail fails, the balance never changes. There is no place where
the UI could observe an intermediate state.

### 2.3 Read contract (UI)

```
GET /api/universal/senders               -> list of senders (public fields)
GET /api/universal/sender-balance/:id    -> { balance }
GET /api/universal/receiver-balance/:id  -> { balance }
POST /api/universal/reset-balances       -> reset to opening for demos
```

The demo screen polls these after every settle / refund and displays the
result. It never computes a next balance locally. If the server says
₹20,000, the UI shows ₹20,000, full stop.

---

## 3. Explicit sandbox labeling (make the boundary obvious)

Every balance in the UI carries a small sub-label:

```
₹25,000
Sandbox ledger · server-owned
```

This is not a disclaimer to hide behind — it's the honest shape of the
demo. The proof pipeline and rails above it are real; the money below
is not; the label states which is which. A judge reading the label and
then checking the network tab sees exactly the same numbers.

---

## 4. Threat model

| Threat | Mitigation |
|---|---|
| UI shows a stale balance and a judge thinks the server is out of sync | Every settle / refund response includes the fresh balance inline — the UI is refreshed by the same call that changed it, not by a separate poll that could race |
| A judge tampers with the client (dev tools) to inflate their balance | Client balance is display-only; server rejects the next quote if source amount exceeds server-side sender balance |
| Reset button lets someone game the demo mid-judge-run | Reset is exposed via an explicit route (`POST /api/universal/reset-balances`), logged into observability, and requires the same admin gate as other ops routes at pilot time |
| Persistence carries state between judges and confuses one about the other | The judge command center exposes ledger + a "Reset all sandbox state" action; ops path is one click, not a code change |
| The "sandbox ledger" label gets missed and someone thinks money moved | Two independent surfaces carry the label: the balance widget itself and the technical receipt block — plus JUDGE.md still holds the plain-English boundary statement |

---

## 5. Scaling / operational note

At demo scale this ledger is a Map. At pilot scale it becomes the same
problem the nullifier-set service already solves: strongly-consistent
per-account writes with concurrent settles. The upgrade path is:

* Move the ledger keying to the same sharding function used elsewhere
  (`shard(sender_id)`, `shard(account_id)`) so no two settles for the
  same sender ever serialize through different shards.
* Debit / credit become CAS operations against the shard rather than
  in-process Map mutations.
* The read contract in §2.3 does not change — the UI never had to know
  about the shape underneath.

This is called out as pilot-scale engineering, not solved in this
document.
