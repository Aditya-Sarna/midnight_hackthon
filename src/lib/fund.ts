/**
 * Product funding — credit free balance on-device and reseal the public commitment.
 * Explicit Circle balance top-up (testnet product rail).
 */
import { compactBalanceCommit, randomOpeningHex } from "./compactCommit";
import {
  alignBalanceCommitmentWithServer,
  applyCredit,
  loadVault,
  saveVault,
  type DeviceVaultState,
} from "./deviceVault";
import { randomNonce } from "./crypto";
import {
  loadPendingLocalApply,
  repairPendingLocalApply,
} from "./pendingApply";

const MAX_TOP_UP = 1_000_000;

export async function fundWallet(
  vaultIn: DeviceVaultState,
  amount: number
): Promise<DeviceVaultState> {
  const credit = Math.floor(Number(amount));
  if (!(credit > 0)) throw new Error("Enter an amount to add");
  if (credit > MAX_TOP_UP) throw new Error(`Max top-up is ${MAX_TOP_UP.toLocaleString()}`);

  // Prefer disk state — React props can lag behind heal-on-load reseals
  let vault = (await loadVault(vaultIn.userId)) ?? vaultIn;

  if (loadPendingLocalApply(vault.userId)) {
    const repaired = await repairPendingLocalApply(vault.userId);
    if (repaired.ok) vault = repaired.vault;
  }

  try {
    vault = await alignBalanceCommitmentWithServer(vault);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not sync balance";
    throw new Error(
      /Stale|reseal|reach account/i.test(msg)
        ? `${msg}. Open Circle once to refresh, then try Add money again.`
        : msg
    );
  }

  const opening = randomOpeningHex();
  const nextBal = vault.balance + credit;
  const commitment = await compactBalanceCommit(nextBal, opening);
  const nonce = randomNonce();

  const res = await fetch(`/api/users/${encodeURIComponent(vault.userId)}/reseal-balance`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      oldBalanceCommitment: vault.balanceCommitment,
      newBalanceCommitment: commitment,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) {
    // One more align+retry — covers race if another tab resealed
    vault = await alignBalanceCommitmentWithServer(vault);
    const retryCommit = await compactBalanceCommit(vault.balance + credit, opening);
    const retry = await fetch(`/api/users/${encodeURIComponent(vault.userId)}/reseal-balance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        oldBalanceCommitment: vault.balanceCommitment,
        newBalanceCommitment: retryCommit,
      }),
    });
    const retryData = await retry.json().catch(() => ({}));
    if (!retry.ok || retryData.ok === false) {
      throw new Error(
        retryData.reason ||
          data.reason ||
          data.error ||
          "Could not update balance commitment"
      );
    }
    let next = await applyCredit(vault, credit, {
      balanceOpening: opening,
      balanceCommitment: retryCommit,
      balanceNonce: nonce,
    });
    next = withTopUpHistory(next, credit);
    await saveVault(next, { activate: true });
    return next;
  }

  let next = await applyCredit(vault, credit, {
    balanceOpening: opening,
    balanceCommitment: commitment,
    balanceNonce: nonce,
  });
  next = withTopUpHistory(next, credit);
  await saveVault(next, { activate: true });
  return next;
}

function withTopUpHistory(vault: DeviceVaultState, credit: number): DeviceVaultState {
  const history = [...(vault.paymentHistory ?? [])];
  history.unshift({
    id: randomNonce(8),
    amount: credit,
    recipient: "Added money",
    category: "top-up",
    timestamp: Date.now(),
    direction: "in",
  });
  return { ...vault, paymentHistory: history.slice(0, 80) };
}
