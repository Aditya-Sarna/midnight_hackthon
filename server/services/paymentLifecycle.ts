/**
 * Durable P2P payment lifecycle — privacy-safe metadata only.
 * Never stores amounts, contacts, openings, or transcripts.
 */
import { randomNonce } from "./crypto.js";
import type { Store } from "./store.js";
import { saveStore } from "./store.js";

export type PaymentLifecycleState =
  | "created"
  | "proof_prepared"
  | "user_authorized"
  | "proof_verified"
  | "rail_reserved"
  | "settled"
  | "device_applied"
  | "recipient_notified"
  | "reconciled"
  | "proof_failed"
  | "rail_failed"
  | "device_apply_failed"
  | "reversal_pending"
  | "refunded"
  | "manual_review";

const SUCCESS_TERMINAL = new Set<PaymentLifecycleState>([
  "reconciled",
  "refunded",
]);

const FAILURE_TERMINAL = new Set<PaymentLifecycleState>([
  "proof_failed",
  "rail_failed",
  "manual_review",
]);

export type PaymentLifecycleRecord = {
  id: string;
  correlationId: string;
  userId: string;
  /** Truncated commitment digests only */
  intentCommitmentPrefix: string;
  nullifierPrefix: string;
  recipientPubkeyPrefix: string;
  state: PaymentLifecycleState;
  proofMode?: string;
  attestationGrade?: string;
  railId?: string;
  railSettlementId?: string;
  receiptId?: string;
  riskDecision?: "allow" | "challenge" | "deny" | "manual_review";
  failureReason?: string;
  /** Universal adapter fields — digests/ids only, never raw destinations */
  routeId?: string;
  quoteId?: string;
  sourceAsset?: string;
  targetAsset?: string;
  sourceAdapter?: string;
  conversionAdapter?: string;
  targetAdapter?: string;
  sourceSettlementId?: string;
  conversionSettlementId?: string;
  targetSettlementId?: string;
  createdAt: number;
  updatedAt: number;
  timeline: Array<{ at: number; state: PaymentLifecycleState; note?: string }>;
};

const ALLOWED: Partial<Record<PaymentLifecycleState, PaymentLifecycleState[]>> = {
  created: ["proof_prepared", "user_authorized", "proof_failed", "manual_review"],
  proof_prepared: ["user_authorized", "proof_failed", "manual_review"],
  user_authorized: ["proof_verified", "proof_failed", "manual_review"],
  proof_verified: ["rail_reserved", "settled", "rail_failed", "manual_review"],
  rail_reserved: ["settled", "rail_failed", "reversal_pending"],
  settled: ["device_applied", "device_apply_failed", "recipient_notified", "reconciled"],
  device_applied: ["recipient_notified", "reconciled"],
  recipient_notified: ["reconciled"],
  device_apply_failed: ["device_applied", "reversal_pending", "manual_review"],
  reversal_pending: ["refunded", "manual_review"],
  proof_failed: [],
  rail_failed: ["reversal_pending", "manual_review"],
  manual_review: ["refunded", "reconciled"],
  refunded: [],
  reconciled: [],
};

function ensureBucket(store: Store): PaymentLifecycleRecord[] {
  if (!store.paymentLifecycle) store.paymentLifecycle = [];
  return store.paymentLifecycle;
}

export function createPaymentLifecycle(
  store: Store,
  input: {
    userId: string;
    correlationId?: string;
    intentCommitment: string;
    spendNullifier: string;
    recipientPubkey: string;
  }
): PaymentLifecycleRecord {
  const now = Date.now();
  const rec: PaymentLifecycleRecord = {
    id: `pay_${randomNonce(10)}`,
    correlationId: input.correlationId ?? `corr_${randomNonce(12)}`,
    userId: input.userId,
    intentCommitmentPrefix: input.intentCommitment.slice(0, 16),
    nullifierPrefix: input.spendNullifier.slice(0, 16),
    recipientPubkeyPrefix: input.recipientPubkey.slice(0, 16),
    state: "created",
    createdAt: now,
    updatedAt: now,
    timeline: [{ at: now, state: "created" }],
  };
  ensureBucket(store).push(rec);
  saveStore(store);
  return rec;
}

export function advancePaymentLifecycle(
  store: Store,
  paymentId: string,
  next: PaymentLifecycleState,
  patch?: Partial<
    Pick<
      PaymentLifecycleRecord,
      | "proofMode"
      | "attestationGrade"
      | "railId"
      | "railSettlementId"
      | "receiptId"
      | "riskDecision"
      | "failureReason"
    >
  > & { note?: string }
): PaymentLifecycleRecord | null {
  const rec = ensureBucket(store).find((p) => p.id === paymentId);
  if (!rec) return null;
  if (SUCCESS_TERMINAL.has(rec.state) || FAILURE_TERMINAL.has(rec.state)) {
    if (rec.state !== next && next !== "refunded" && next !== "manual_review") {
      return rec;
    }
  }
  const allowed = ALLOWED[rec.state] ?? [];
  if (rec.state !== next && !allowed.includes(next)) {
    rec.timeline.push({
      at: Date.now(),
      state: rec.state,
      note: `illegal_transition_blocked→${next}`,
    });
    saveStore(store);
    return rec;
  }
  rec.state = next;
  rec.updatedAt = Date.now();
  if (patch?.proofMode !== undefined) rec.proofMode = patch.proofMode;
  if (patch?.attestationGrade !== undefined) rec.attestationGrade = patch.attestationGrade;
  if (patch?.railId !== undefined) rec.railId = patch.railId;
  if (patch?.railSettlementId !== undefined) rec.railSettlementId = patch.railSettlementId;
  if (patch?.receiptId !== undefined) rec.receiptId = patch.receiptId;
  if (patch?.riskDecision !== undefined) rec.riskDecision = patch.riskDecision;
  if (patch?.failureReason !== undefined) rec.failureReason = patch.failureReason;
  rec.timeline.push({ at: rec.updatedAt, state: next, note: patch?.note });
  saveStore(store);
  return rec;
}

export function getPaymentLifecycle(
  store: Store,
  paymentId: string
): PaymentLifecycleRecord | undefined {
  return store.paymentLifecycle?.find((p) => p.id === paymentId);
}

export function listPaymentLifecycleForUser(
  store: Store,
  userId: string,
  limit = 40
): PaymentLifecycleRecord[] {
  return (store.paymentLifecycle ?? [])
    .filter((p) => p.userId === userId)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, limit);
}

export function publicReceiptView(rec: PaymentLifecycleRecord) {
  return {
    receiptId: rec.receiptId ?? rec.id,
    paymentId: rec.id,
    correlationId: rec.correlationId,
    state: rec.state,
    proofMode: rec.proofMode,
    attestationGrade: rec.attestationGrade,
    railId: rec.railId,
    timeline: rec.timeline.map((t) => ({
      at: t.at,
      state: t.state,
      note: t.note,
    })),
    updatedAt: rec.updatedAt,
  };
}
