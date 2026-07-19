/**
 * Enroll cloud recovery meta: upload wrap-encrypted Class 0 ciphertext.
 * Reconstruction still needs this device's wrap key (IndexedDB).
 */
import { api } from "./api";

const VAULT_PREFIX = "circled_vault_v3_";
const SHARES_KEY = (userId: string) => `circle_recovery_shares_${userId}`;

export async function enrollCloudRecovery(userId: string): Promise<{
  ok: boolean;
  reason?: string;
  threshold?: number;
}> {
  const ct = localStorage.getItem(`${VAULT_PREFIX}${userId}`);
  if (!ct) return { ok: false, reason: "No local vault ciphertext to enroll" };

  try {
    const res = await fetch(`/api/users/${encodeURIComponent(userId)}/vault/enroll`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vaultCiphertext: ct }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, reason: data.error || "Enroll failed" };
    if (Array.isArray(data.deviceShares)) {
      try {
        localStorage.setItem(SHARES_KEY(userId), JSON.stringify(data.deviceShares));
      } catch {
        /* ignore */
      }
    }
    return { ok: true, threshold: data.threshold };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "Enroll failed" };
  }
}

export async function recoveryBackupStatus(userId: string): Promise<{
  enrolled: boolean;
  threshold?: number;
  holders?: { id: string; label: string }[];
}> {
  try {
    const v = await api.vault(userId);
    return { enrolled: true, threshold: v.threshold, holders: v.holders };
  } catch {
    return { enrolled: false };
  }
}
