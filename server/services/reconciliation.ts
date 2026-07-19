/**
 * Reconcile Compact proof settle ↔ rail receipt ↔ device-apply ack.
 * Privacy-safe: IDs and states only.
 */
import type { Store } from "./store.js";
import {
  advancePaymentLifecycle,
  getPaymentLifecycle,
  type PaymentLifecycleRecord,
} from "./paymentLifecycle.js";
import { saveStore } from "./store.js";

export type ReconcileInput = {
  paymentId: string;
  proofEventId?: string;
  railSettlementId?: string;
  deviceApplied?: boolean;
  recipientNotified?: boolean;
};

export type ReconcileResult = {
  ok: boolean;
  state: PaymentLifecycleRecord["state"] | "missing";
  gaps: string[];
  receiptId?: string;
};

export function reconcilePayment(store: Store, input: ReconcileInput): ReconcileResult {
  const rec = getPaymentLifecycle(store, input.paymentId);
  if (!rec) return { ok: false, state: "missing", gaps: ["payment_not_found"] };

  const gaps: string[] = [];
  if (!rec.attestationGrade || rec.attestationGrade === "rejected") {
    gaps.push("proof_incomplete");
  }
  if (rec.railId && !rec.railSettlementId && !input.railSettlementId) {
    gaps.push("rail_receipt_missing");
  }
  if (input.railSettlementId && !rec.railSettlementId) {
    advancePaymentLifecycle(store, rec.id, rec.state, {
      railSettlementId: input.railSettlementId,
    });
  }

  if (input.deviceApplied) {
    advancePaymentLifecycle(store, rec.id, "device_applied", {
      note: "device_ack",
    });
  } else if (["settled", "rail_reserved"].includes(rec.state)) {
    gaps.push("device_apply_pending");
  }

  if (input.recipientNotified) {
    advancePaymentLifecycle(store, rec.id, "recipient_notified", {
      note: "notify_ack",
    });
  }

  const fresh = getPaymentLifecycle(store, input.paymentId)!;
  if (
    gaps.filter((g) => g !== "device_apply_pending").length === 0 &&
    (input.deviceApplied || fresh.state === "device_applied" || fresh.state === "recipient_notified")
  ) {
    const receiptId = fresh.receiptId ?? `rcpt_${fresh.id.slice(4)}`;
    advancePaymentLifecycle(store, fresh.id, "reconciled", {
      receiptId,
      note: input.proofEventId ? `event:${input.proofEventId.slice(0, 12)}` : "reconciled",
    });
    saveStore(store);
    return {
      ok: true,
      state: "reconciled",
      gaps: [],
      receiptId,
    };
  }

  saveStore(store);
  return {
    ok: gaps.length === 0,
    state: getPaymentLifecycle(store, input.paymentId)!.state,
    gaps,
    receiptId: fresh.receiptId,
  };
}

export function reconciliationSummary(store: Store) {
  const rows = store.paymentLifecycle ?? [];
  const byState: Record<string, number> = {};
  for (const r of rows) {
    byState[r.state] = (byState[r.state] ?? 0) + 1;
  }
  return {
    total: rows.length,
    byState,
    openGaps: rows.filter((r) =>
      ["settled", "device_apply_failed", "rail_failed", "reversal_pending", "manual_review"].includes(
        r.state
      )
    ).length,
  };
}
