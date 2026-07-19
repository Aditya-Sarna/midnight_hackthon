/**
 * After server settle succeeds, Class 0 applySpend can still fail.
 * Persist openings so the wallet can Repair without re-spending.
 */
import { applySpend, loadVault, type DeviceVaultState } from "./deviceVault";

const KEY = "circle_pending_local_apply";

export type PendingLocalApply = {
  userId: string;
  amount: number;
  recipient: string;
  category: string;
  countersNext: Record<string, number>;
  balanceNonce: string;
  balanceOpening: string;
  balanceCommitment: string;
  policyNonce: string;
  policyCommitment: string;
  savedAt: number;
};

export function savePendingLocalApply(p: PendingLocalApply): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

export function loadPendingLocalApply(userId: string): PendingLocalApply | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as PendingLocalApply;
    if (p.userId !== userId) return null;
    return p;
  } catch {
    return null;
  }
}

export function clearPendingLocalApply(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export async function repairPendingLocalApply(
  userId: string
): Promise<{ ok: true; vault: DeviceVaultState } | { ok: false; reason: string }> {
  const pending = loadPendingLocalApply(userId);
  if (!pending) return { ok: false, reason: "Nothing to repair" };
  const vault = await loadVault(userId);
  if (!vault) return { ok: false, reason: "Device vault missing — re-open Circle on this device" };

  // Already applied (balance commitment matches post-settle)
  if (vault.balanceCommitment === pending.balanceCommitment) {
    clearPendingLocalApply();
    return { ok: true, vault };
  }

  try {
    const next = await applySpend(
      vault,
      pending.amount,
      pending.countersNext,
      {
        balanceNonce: pending.balanceNonce,
        balanceOpening: pending.balanceOpening,
        balanceCommitment: pending.balanceCommitment,
        policyNonce: pending.policyNonce,
        policyCommitment: pending.policyCommitment,
      },
      {
        recipient: pending.recipient,
        category: pending.category || "general",
      }
    );
    clearPendingLocalApply();
    return { ok: true, vault: next };
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : "Repair failed — reload and check balance",
    };
  }
}
