# Circled Credit — v1

Same-asset, **fully overcollateralized** lending on Midnight Compact. This is **not** undercollateralized lending and **not** zero-collateral lending.

## Model

| Version | Status | Mechanism |
|---------|--------|-----------|
| **v1** | Implemented | Same-asset; collateral ≥ 150% of loan; pool-funded |
| **v1.5** | Not built | Cross-asset + narrow oracle boundary |
| **v2** | Not built | Reduced-collateral for high standing, risk-buffer tranche |
| Zero-collateral | Permanently out of scope | Economic risk-capital problem, not a circuit problem |

## Sybil resistance & unlinkability

- **Anchor:** KYC leaf from the core registry (`prove_kyc_membership`). One government-verified identity → one credit history.
- **Scoped identity:** `credit_identity = hash(kyc_leaf, "circled:credit-scope-salt:v1")`.
- **Deliberate exception:** `credit_identity` links loans for the same person inside the lending module only. It is never sent to payment counterparties or Circled-Auth relying parties, and never combined with payment nullifiers.

## Circuits (Compact)

1. `prove_collateral_lock` — balance lock + 2×collateral ≥ 3×loan
2. `prove_pool_deposit` — lender funds pool (no borrower link)
3. `prove_loan_repayment` — installment bound to `credit_identity`
4. `prove_credit_standing` — **in-circuit** `on_time ≥ threshold` and `defaults ≤ max`; public output is pass/fail only (never a numeric score)
5. `prove_pool_solvency` — aggregate coverage bind

## Capital

Lenders deposit into a **pooled** commitment. Borrowers draw from the pool. No lender–borrower pairing appears in proofs or public loan state.

## Cold start

New `credit_identity`s have zero history. They are eligible only for v1 overcollateralized terms until `minHistoryForV2` on-time installments (configurable; default 6).

## Compliance (§8) — explicit decisions

| Surface | Implementation |
|---------|----------------|
| **APR disclosure** | Borrower always sees APR (`CREDIT_APR_BPS`, default 12%) before Accept — even though amounts stay private to others |
| **Bureau furnishing** | `CREDIT_BUREAU_MODE=jurisdiction_exempt` (default) **or** `selective_disclosure` (view-key compelled report) **or** `unresolved` (blocks origination) |
| **Jurisdiction gate** | `CREDIT_JURISDICTIONS` allow-list; enforced when `NYXPAY_STRICT=1` |
| **Licensing** | Named as required legal review — **not** auto-resolved by software |

Endpoints: `GET /api/skills/circled-credit/compliance`, `GET .../disclosure`, `POST .../bureau-furnish`.

## Voice

From the home card or Circled app mic (Accept + rate checkbox required for borrow):

| Say | Action |
|-----|--------|
| `borrow 1000` / `take a loan of 1000` / `1000 ka loan` | Borrow with default 150% collateral |
| `borrow 1000 with 2000 collateral` | Borrow with explicit collateral |
| `repay my loan` / `pay installment` | Pay next installment on active loan |
| `check my credit` / `credit standing` | Pass/fail standing threshold |

Requires pool liquidity and enough free balance to lock collateral. Vault openings auto-reseal to Compact `persistentCommit` on load / before credit ops.

## API

| Method | Path |
|--------|------|
| GET | `/api/skills/circled-credit` |
| GET | `/api/skills/circled-credit/status` |
| GET | `/api/skills/circled-credit/compliance` |
| GET | `/api/skills/circled-credit/disclosure` |
| POST | `/api/skills/circled-credit/identity` |
| POST | `/api/skills/circled-credit/pool/deposit` |
| POST | `/api/skills/circled-credit/borrow` |
| POST | `/api/skills/circled-credit/repay` |
| POST | `/api/skills/circled-credit/standing` |
| POST | `/api/skills/circled-credit/liquidate` |
| POST | `/api/skills/circled-credit/bureau-furnish` |
| GET | `/api/skills/circled-credit/loans/:userId` |

UI: main menu → **Credit** (V), or voice from the home card.

## Compile

```bash
npm run compact:compile
rm -f data/compact-ledger.json   # after ledger-shape changes
```
