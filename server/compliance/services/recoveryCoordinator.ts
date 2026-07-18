import type { Store } from "../../services/store.js";
import { getVaultMeta } from "../../services/vault.js";

/**
 * Recovery Vault Coordinator (§1 / §5)
 * Touches: share metadata only
 * Must NOT touch: reconstructed key, decrypted bundle
 */
export class RecoveryVaultCoordinator {
  constructor(private store: Store) {}

  status(userId: string) {
    const meta = getVaultMeta(this.store, userId);
    if (!meta) return null;
    return {
      threshold: meta.threshold,
      holders: meta.holders.map((h) => ({
        id: h.id,
        label: h.label,
        weight: h.weight,
        contentHeld: false,
      })),
      cloudProcessorDisclosed: true,
      note: "Coordinator never sees reconstructed key or decrypted vault bundle — Class 0 stays on device",
      dataClass: 3 as const,
    };
  }

  processorDisclosure() {
    return {
      cloudShareIsProcessor: true,
      reason:
        "Possession of a below-threshold encrypted share still creates processor status under most privacy regimes — DPA required (§5 / §7).",
      shareUsabilityAlone: "cryptographically meaningless",
    };
  }
}
