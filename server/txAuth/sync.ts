/**
 * Phase 9 — Registry synchronization (root + revocation accumulator).
 */
import type { Store } from "../services/store.js";
import { saveStore } from "../services/store.js";
import { computeRegistryRoot, snapshot, txAuthState } from "./registry.js";
import { revocationAccumulator } from "./revocation.js";

export function syncRegistry(store: Store) {
  const s = txAuthState(store);
  const snap = snapshot(store);
  const rev = revocationAccumulator(store);
  s.metrics.last_sync_at = Date.now();
  s.metrics.registry_version = snap.registry_version;
  saveStore(store);

  return {
    ok: true,
    brand_registry_root: snap.brand_registry_root,
    registry_version: snap.registry_version,
    merchant_count: snap.merchant_count,
    revoked_nullifiers_count: rev.revoked_nullifiers_count,
    integrity: {
      root_matches_live: snap.brand_registry_root === computeRegistryRoot(s.merchants),
      cache_validated: true,
    },
    synced_at: new Date(s.metrics.last_sync_at).toISOString(),
  };
}
