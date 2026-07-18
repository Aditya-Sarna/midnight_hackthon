/**
 * Phase 1.3 — Revocation service (nullifier accumulator + root update).
 */
import type { Store } from "../services/store.js";
import { saveStore } from "../services/store.js";
import { computeRegistryRoot, findMerchant, txAuthState } from "./registry.js";

export function revokeMerchant(
  store: Store,
  merchant_identifier: string,
  reason = "AUTHORIZATION_ENDED"
):
  | {
      ok: true;
      nullifier: string;
      brand_registry_root: string;
      registry_version: number;
      reason: string;
    }
  | { ok: false; reason: string } {
  const m = findMerchant(store, merchant_identifier, { includeRevoked: true });
  if (!m) return { ok: false, reason: "merchant_not_found" };

  const s = txAuthState(store);
  m.status = "revoked";
  if (!s.revoked_nullifiers.includes(m.revocation_nullifier)) {
    s.revoked_nullifiers.push(m.revocation_nullifier);
  }
  s.registry_version += 1;
  s.metrics.registry_version = s.registry_version;
  saveStore(store);

  return {
    ok: true,
    nullifier: m.revocation_nullifier,
    brand_registry_root: computeRegistryRoot(s.merchants),
    registry_version: s.registry_version,
    reason,
  };
}

export function isNullifierRevoked(store: Store, nullifier: string): boolean {
  return txAuthState(store).revoked_nullifiers.includes(nullifier);
}

export function revocationAccumulator(store: Store) {
  const s = txAuthState(store);
  return {
    revoked_nullifiers_count: s.revoked_nullifiers.length,
    /** Public set — nullifiers only, no merchant PII */
    revoked_nullifiers: s.revoked_nullifiers.slice(-100),
    brand_registry_root: computeRegistryRoot(s.merchants),
    registry_version: s.registry_version,
  };
}
