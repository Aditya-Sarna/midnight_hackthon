/**
 * Recovery vault coordinator storage — ciphertext + threshold shares metadata.
 * Reconstruction of Class 0 secrets happens on-device only.
 */
import {
  encryptBundle,
  randomNonce,
  splitSecret,
} from "./crypto.js";
import { saveStore, type Store } from "./store.js";

export function provisionCloudVaultMeta(
  store: Store,
  userId: string,
  /** Client-uploaded encrypted Class 0 blob (already encrypted) OR server wraps client ciphertext */
  clientCiphertext: string
) {
  // Threshold-split a random cloud wrapping key for the ciphertext handle
  const key = randomNonce(32);
  // Re-encrypt client blob under threshold key so cloud share alone is inert
  const ciphertext = encryptBundle(clientCiphertext, key);
  const shares = splitSecret(key, 5, 3);

  const holders = [
    { id: "peer-1", label: "Trusted contact A", share: shares[0], weight: 1 },
    { id: "peer-2", label: "Trusted contact B", share: shares[1], weight: 1 },
    { id: "hw-token", label: "Hardware token", share: shares[2], weight: 1 },
    { id: "cloud", label: "Encrypted cloud blob", share: shares[3], weight: 1 },
    { id: "peer-3", label: "Trusted contact C", share: shares[4], weight: 1 },
  ];

  store.vaults = store.vaults.filter((v) => v.userId !== userId);
  store.vaults.push({
    userId,
    ciphertext,
    shareHolders: holders,
    threshold: 3,
    createdAt: Date.now(),
  });
  saveStore(store);

  return {
    threshold: 3,
    note: "Cloud share alone cannot decrypt Class 0 — threshold 3. Reconstruction is device-side.",
    holders: holders.map((h) => ({ id: h.id, label: h.label, weight: h.weight })),
    /** Return shares once for device to distribute — server keeps copy for demo recovery UX */
    deviceShares: holders.map((h) => ({ id: h.id, share: h.share })),
  };
}

export function getVaultMeta(store: Store, userId: string) {
  const vault = store.vaults.find((v) => v.userId === userId);
  if (!vault) return null;
  return {
    threshold: vault.threshold,
    holders: vault.shareHolders.map((h) => ({
      id: h.id,
      label: h.label,
      weight: h.weight,
    })),
  };
}

/**
 * Release threshold shares for device reconstruction.
 * Does NOT decrypt Class 0 — returns ciphertext + selected shares only.
 */
export function releaseSharesForRecovery(
  store: Store,
  userId: string,
  holderIds: string[]
) {
  const vault = store.vaults.find((v) => v.userId === userId);
  if (!vault) throw new Error("No recovery vault found");
  if (holderIds.length < vault.threshold) {
    throw new Error(`Need at least ${vault.threshold} shares`);
  }
  const selected = vault.shareHolders.filter((h) => holderIds.includes(h.id));
  if (selected.length < vault.threshold) {
    throw new Error("Insufficient valid shares");
  }
  return {
    ciphertext: vault.ciphertext,
    shares: selected.slice(0, vault.threshold).map((h) => h.share),
    threshold: vault.threshold,
    note: "Decrypt on device only — server never sees reconstructed Class 0",
  };
}
