# Compact contract upgrade path

## Versioning

- Source of truth: `contracts/nyxpay.compact`
- Current pragma: `language_version 0.23`
- Policy circuit: `prove_policy_update` is `proof: true` (ledger `policy_update_count`) — amount via `policyAmount()` witness only
- Artifacts: `contracts/managed/nyxpay/` (keys, zkir, compiler info)

## Bump procedure

1. Edit circuits in `contracts/nyxpay.compact` (prefer additive witnesses / new circuits).
2. Increment a comment header version, e.g. `* Circle Compact v5.1`.
3. Compile: `npm run compact:compile`
4. Confirm new prover keys under `contracts/managed/nyxpay/keys/`.
5. Run `npm test` — settle + zkProve suites must pass.
6. If public inputs / witness bags change, update:
   - `server/services/compactLedger.ts` (witness bag + replay)
   - `server/services/proofServer.ts`
   - `src/lib/payments.ts` client intent bindings
7. Deploy proof-server with matching ZKIR; never mix old keys with new bytecode.

## Migration notes

- Device Class 0 vaults are unaffected by circuit bumps (commitments stay opaque).
- Server store schema is independent; bump `storeSchema` only if event meta shape changes.
- Prefer new circuits over mutating existing public argument lists (break-glass: dual-path attest for one release).
