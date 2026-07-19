# Circled — Multi-Sender Persona (From "One Aditya" to a Pilot-Shaped Sample)

## Purpose

The demo currently ships with a single hard-coded sender ("Aditya",
INR 25,000, jurisdiction IN) and a small set of sandbox receiver
accounts. That's the correct call for the first-90-seconds pitch, but
it makes any pilot claim thin: "we support multi-tenant" reads as a
posture, not as a demonstrated property, when the demo only ever runs
one tenant.

This document specifies a small, real multi-sender persona set that
preserves the demo's speed while making the multi-tenant claim
first-class in the code — not just in the pitch.

**Core design commitment carried through this document:** senders are
first-class server-owned entities, not client-side labels. Every
route-commitment already binds `intent.sender_id`; making senders real
just makes that binding meaningful across multiple identities.

---

## 1. Why "add a name dropdown" is not enough

The naive fix — a client-side dropdown of names that all resolve to
the same backend sender — fails on the same axis as the trust-surface
problem:

1. **The route commitment already encodes `sender_id`.** A UI-only
   persona switch means every settle still binds to the single sandbox
   sender, and any judge who reads the receipt sees that.
2. **Jurisdiction / compliance vary by persona.** An INR sender in IN
   and an INR sender in SG hit different compliance decisions — a
   dropdown that doesn't reach the backend can't demonstrate that.
3. **Balances have to be per-sender.** The trust-surface fix
   (`CIRCLED_TRUST_SURFACE.md`) puts the sandbox ledger on the server;
   personas without server-side identity have no place to keep
   balances.

So the actual fix is a server-owned persona registry that plugs into
the existing `sender_id` field the pipeline already uses.

---

## 2. Persona registry (server-owned, small, real)

### 2.1 Shape

```
SandboxSender:
  id:            "snd_aditya" | "snd_priya" | "snd_rahul"
  display_name:  string
  handle:        string           // e.g. "aditya.in"
  asset:         "INR" | "USD"    // source currency for this persona
  jurisdiction:  "IN" | "US" | "SG" | ...
  opening_balance: number         // per-persona reset target
  balance:       number           // current, server-owned
  note:          string           // short label, e.g. "small-biz operator"
```

Three ships-with personas cover the pilot claim:

| id | display_name | jurisdiction | asset | opening_balance | note |
|---|---|---|---|---|---|
| snd_aditya | Aditya Rao | IN | INR | 25,000 | consumer P2P |
| snd_priya  | Priya Nair | IN | INR | 250,000 | small-biz operator |
| snd_rahul  | Rahul Kim  | US | USD | 2,500  | US sender · fiat cross |

Each persona is a real server-side identity: quotes, routes, and
settles all bind to its `id`. Balances are per-persona. Compliance
decisions vary because source asset and jurisdiction vary.

### 2.2 Wire into the existing intent

```
POST /api/universal/quote { accountId, amount, senderId, sourceAsset?, ... }
  intent.sender_id     = senderId       // (was: hardcoded "sandbox_sender")
  intent.source_asset  = sender.asset   // if sourceAsset not overridden
```

`route_commitment` already includes `intent.sender_id`; nothing in the
proof pipeline changes shape — it just now receives real distinct
values across runs.

### 2.3 UI shape

A persona picker row above the two-phone demo. Selecting a persona:

1. Updates the sender phone header (name + jurisdiction badge).
2. Refreshes the displayed balance via `GET
   /api/universal/sender-balance/:id`.
3. Passes `senderId` on the next `POST /api/universal/quote`.

No new pages, no new modes — one row of chips on the existing screen.

---

## 3. Compliance surfaces that senders make demonstrable

A single persona could never show these because the source side never
changed. Three worth wiring:

* **INR (IN) → USD (US) receiver** — `challenge` decision, cleared via
  Maya's sandbox-verified KYC. Aditya path.
* **INR (IN) → BTC (IN) receiver** — `enhanced_kyc_required`, cleared
  via Arjun's enhanced KYC + wallet screening. Aditya path.
* **USD (US) → USD (US) receiver** — `allow` (same-jurisdiction fiat).
  Rahul path.

The compliance branches already exist in `evaluateRouteCompliance` —
the personas just make them reachable from the demo without editing
code between runs.

---

## 4. Threat model

| Threat | Mitigation |
|---|---|
| Persona picker is client-side only; server still binds to `sandbox_sender` | Persona `id` is sent to `/api/universal/quote`; server writes it into `intent.sender_id`; route commitment covers it; receipt shows it |
| Two personas share a balance and one appears to fund the other | Balances are keyed on `sender.id` in the server ledger (§2.1); one sender can never see or affect another sender's balance |
| A persona with a huge opening balance is used to bypass a low-balance failure demo | Reset endpoint restores per-persona opening balances (§5); balance failure demo pins to Aditya, whose opening is 25,000 |
| Adding personas makes the demo screen crowded and slower to grasp | Personas render as a single chip row; default persona is Aditya (same as before); a judge who doesn't touch the row sees the exact same demo |
| Persona display names leak across personas via URL / receipt | Only `sender.id` (opaque) and `sender.display_name` (which is the sender's own public choice) go into the receipt; jurisdiction and asset are the only additional public fields; no cross-persona linkage exists |
| A persona is edited via the API in a way that changes an existing route's compliance | Sender fields are treated as immutable at the persona-registry level; a new persona is created rather than mutated; existing route commitments continue to bind to their frozen `sender_id` |

---

## 5. Scaling / operational note

Three personas is a demo shape, not a pilot shape. Two things a pilot
would add, called out for later:

* **Real sender KYC binding.** At pilot, `sender.id` derives from a
  scoped identity commitment (same pattern as `handle_identity` in
  the identity-resolution doc), not a hand-picked string. Migration
  path: keep the persona table as a demo overlay, load real senders
  from the KYC leaf set at pilot boot.
* **Per-persona rate limits / quotas.** The rate-limit middleware
  currently keys on IP; at pilot it keys on `sender.id`. Same
  observability surface, same shard discipline as the sandbox ledger
  (§CIRCLED_TRUST_SURFACE.md).

Neither is on the critical path for the multi-tenant demonstration
this document specifies. They are the pilot next step, and they are
called out here rather than left implicit.
