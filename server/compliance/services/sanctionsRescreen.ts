import type { Store } from "../../services/store.js";
import { saveStore } from "../../services/store.js";
import { SANCTIONS_RESCREEN_MS } from "../posture.js";
import { RevocationService } from "./revocation.js";

/**
 * Operational sanctions re-screen (§4 / §7 gap: sanctions-list staleness)
 * Stale credentials → revocation, not silent continued validity.
 */
export class SanctionsRescreenService {
  constructor(private store: Store) {}

  /**
   * Re-check issuance records older than cadence.
   * Demo: randomly "hits" sanctions for none by default; force via option.
   */
  rescreen(opts?: { forceStaleRevoke?: boolean; forceHitNullifier?: string }) {
    const now = Date.now();
    if (!this.store.issuanceRecords) this.store.issuanceRecords = [];
    const revocation = new RevocationService(this.store);
    const actions: { issuanceRef: string; action: string }[] = [];

    for (const rec of this.store.issuanceRecords) {
      const stale = now - rec.sanctionsCheckedAt >= SANCTIONS_RESCREEN_MS;
      if (!stale && !opts?.forceStaleRevoke) continue;

      rec.sanctionsCheckedAt = now;
      // Placeholder: real deploy calls live sanctions-list provider
      const hit =
        opts?.forceHitNullifier &&
        this.store.kycLeaves.some(
          (l) =>
            l.nullifier === opts.forceHitNullifier &&
            l.leaf === rec.credentialCommitment
        );

      if (hit || (opts?.forceStaleRevoke && opts.forceHitNullifier)) {
        const leaf = this.store.kycLeaves.find(
          (l) => l.leaf === rec.credentialCommitment
        );
        if (leaf && !leaf.revoked) {
          revocation.revokeByNullifier(leaf.nullifier, "SANCTIONS_UPDATE");
          rec.sanctionsClear = false;
          actions.push({ issuanceRef: rec.issuanceRef, action: "revoked_sanctions_update" });
        }
      } else if (stale || opts?.forceStaleRevoke) {
        // Mark re-checked clear
        rec.sanctionsClear = true;
        actions.push({ issuanceRef: rec.issuanceRef, action: "rescreened_clear" });
      }
    }

    // Also mark leaves whose issuance metadata is missing but overdue by policy
    for (const leaf of this.store.kycLeaves) {
      if (leaf.revoked) continue;
      if (opts?.forceHitNullifier === leaf.nullifier) {
        revocation.revokeByNullifier(leaf.nullifier, "SANCTIONS_UPDATE");
        actions.push({ issuanceRef: leaf.nullifier.slice(0, 12), action: "revoked_forced" });
      }
    }

    saveStore(this.store);
    return {
      cadenceMs: SANCTIONS_RESCREEN_MS,
      actions,
      note: "Stale sanctions_clear must not remain silently valid — revoke or re-attest.",
    };
  }
}
