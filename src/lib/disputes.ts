import type { DeviceVaultState, PaymentRecord } from "./deviceVault";
import {
  alignBalanceCommitmentWithServer,
  applyCredit,
  saveVault,
} from "./deviceVault";
import { randomNonce } from "./crypto";
import { compactBalanceCommit, randomOpeningHex } from "./compactCommit";

export type Dispute = {
  id: string;
  paymentId: string;
  amount: number;
  reason: string;
  status: string;
  note?: string;
};

export async function openPaymentDispute(
  userId: string,
  payment: PaymentRecord,
  reason = "mistaken_recipient"
) {
  const res = await fetch(`/api/users/${encodeURIComponent(userId)}/disputes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      paymentId: payment.id,
      amount: payment.amount,
      reason,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not open dispute");
  return data.dispute as Dispute;
}

export async function approveRefundOnDevice(
  vaultIn: DeviceVaultState,
  payment: PaymentRecord,
  disputeId: string
): Promise<DeviceVaultState> {
  const vault = await alignBalanceCommitmentWithServer(vaultIn);
  const opening = randomOpeningHex();
  const nextBal = vault.balance + payment.amount;
  const commitment = await compactBalanceCommit(nextBal, opening);
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
    throw new Error(data.reason || data.error || "Could not reseal after refund");
  }
  let next = await applyCredit(vault, payment.amount, {
    balanceOpening: opening,
    balanceCommitment: commitment,
    balanceNonce: randomNonce(),
  });
  const history = (next.paymentHistory ?? []).map((p) =>
    p.id === payment.id ? { ...p, status: "refunded" as const, disputeId } : p
  );
  history.unshift({
    id: randomNonce(8),
    amount: payment.amount,
    recipient: `Refund · ${payment.recipient}`,
    category: "refund",
    timestamp: Date.now(),
    direction: "in",
    parentPaymentId: payment.id,
    status: "settled",
  });
  next = { ...next, paymentHistory: history.slice(0, 80) };
  await saveVault(next, { activate: true });
  await fetch(`/api/disputes/${encodeURIComponent(disputeId)}/advance`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "refund_approved" }),
  });
  return next;
}

export async function markPaymentDisputed(
  vault: DeviceVaultState,
  paymentId: string,
  disputeId: string
): Promise<DeviceVaultState> {
  const history = (vault.paymentHistory ?? []).map((p) =>
    p.id === paymentId ? { ...p, status: "disputed" as const, disputeId } : p
  );
  const next = { ...vault, paymentHistory: history };
  await saveVault(next, { activate: true });
  return next;
}
