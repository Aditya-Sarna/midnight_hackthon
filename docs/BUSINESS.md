# Circle — Business one-pager

## Problem

Consumer payments still lean on OTPs and passwords — phishable, SIM-swappable, hostile to conversion. Public ledgers expose balances and flows. Proprietary trading / receive strategies cannot sit on transparent chains without leaking edge.

## Solution

**Circle** — voice-first confidential payments on Midnight.

- Speak amount + name (UPI-simple UX)
- **CircleProof** session auth replaces OTP
- **Compact** circuits move money as commitments; amounts stay private witnesses
- Device **Class 0** vault holds keys, balance, openings, contacts
- Optional **private strategy commitment** — strategy weights never hit the public ledger

## Who pays

| Segment | Why Circle |
|---|---|
| Neobanks / fintech apps | Higher auth completion, lower OTP fraud |
| Remittance / cross-border | Confidential amounts + selective disclosure for travel-rule |
| Merchant accept | Private inbound notes + verified brand rails |
| Trading / treasury desks | Commit strategies without publishing parameters |

## Wedge

Ship **speak-to-pay privately** first. Expand to credit standing proofs and strategy commitments once the wallet habit exists.

## Pilot offer (90 days)

1. Sandbox Compact + proof-server SNARK settle  
2. Guided voice-pay demo for internal stakeholders  
3. KYC leaf + selective disclosure review with compliance  
4. Success metric: successful private settle with `grade: zk-proved` and &lt;3 min guided path  

## Moat

- Midnight Compact + live `/prove` path (not a mock ZK UI)
- Class 0 non-extractable device vault
- CircleProof as OTP replacement bound to the same KYC tree
- Productized demo / judge path (`npm run judge`, [JUDGE.md](../JUDGE.md))

## Honest non-goals (near term)

- Full DEX / order-book trading engine  
- Guaranteed Preprod broadcast without a funded wallet  
- Claiming the prover host never receives witnesses  

## Ask

Design partners for a 90-day pilot in remittance or neobank auth. Contact via hackathon team channel.
