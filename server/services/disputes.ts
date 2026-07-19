/**
 * Consumer dispute / refund coordination — metadata only (Class 2/3).
 * Class 0 refund of balance still happens on-device after both parties agree.
 */
import { randomNonce } from "./crypto.js";
import { saveStore, type Store } from "./store.js";

export type DisputeStatus =
  | "opened"
  | "merchant_review"
  | "refund_approved"
  | "refund_rejected"
  | "closed";

export type DisputeRecord = {
  id: string;
  userId: string;
  paymentId: string;
  amount: number;
  reason: string;
  status: DisputeStatus;
  createdAt: number;
  updatedAt: number;
  note?: string;
};

export function openDispute(
  store: Store,
  input: {
    userId: string;
    paymentId: string;
    amount: number;
    reason: string;
  }
): DisputeRecord {
  if (!store.disputes) store.disputes = [];
  const rec: DisputeRecord = {
    id: `dsp_${randomNonce(8)}`,
    userId: input.userId,
    paymentId: input.paymentId,
    amount: Math.floor(Number(input.amount)),
    reason: String(input.reason || "mistaken_recipient").slice(0, 200),
    status: "opened",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    note: "Pilot dispute — refund of Class 0 balance is applied on-device after approval",
  };
  store.disputes.unshift(rec);
  saveStore(store);
  return rec;
}

export function listDisputes(store: Store, userId: string): DisputeRecord[] {
  return (store.disputes ?? []).filter((d) => d.userId === userId);
}

export function advanceDispute(
  store: Store,
  id: string,
  status: DisputeStatus
): DisputeRecord {
  const rec = (store.disputes ?? []).find((d) => d.id === id);
  if (!rec) throw new Error("Dispute not found");
  rec.status = status;
  rec.updatedAt = Date.now();
  saveStore(store);
  return rec;
}
