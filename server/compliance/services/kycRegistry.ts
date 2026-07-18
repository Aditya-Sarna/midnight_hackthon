import { merkleRoot, sha256 } from "../../services/crypto.js";
import type { KycLeaf, Store } from "../../services/store.js";
import { saveStore } from "../../services/store.js";

/**
 * KYC Registry Writer (§1)
 * Touches: commitment hashes only
 * Must NOT touch: preimage fields when writing public root
 */
export class KycRegistryWriter {
  constructor(private store: Store) {}

  /** Publish leaf commitment to Merkle tree — public root only */
  publishCommitment(leaf: KycLeaf): { kycRegistryRoot: string; leafCommitment: string } {
    // Strip any temptation to store preimage on "public" path — only leaf hash enters tree
    const commitmentOnly = leaf.leaf;
    if (!this.store.kycLeaves.find((l) => l.leaf === commitmentOnly)) {
      this.store.kycLeaves.push({ ...leaf, revoked: false });
    }
    this.recomputeRoot();
    saveStore(this.store);
    return {
      kycRegistryRoot: this.store.kycRoot,
      leafCommitment: commitmentOnly,
    };
  }

  /** Public view — Class 1 only */
  publicRoot() {
    return {
      kyc_registry_root: this.store.kycRoot,
      activeLeafCount: this.store.kycLeaves.filter((l) => !l.revoked).length,
      dataClass: 1 as const,
    };
  }

  recomputeRoot() {
    const leaves = this.store.kycLeaves.filter((l) => !l.revoked).map((l) => l.leaf);
    this.store.kycRoot = merkleRoot(leaves.length ? leaves : [sha256("nyx:empty")]);
  }
}
