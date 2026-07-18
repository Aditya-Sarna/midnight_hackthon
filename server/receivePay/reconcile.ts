/**
 * Phase 5 — Reconciliation by order_ref.
 * Match inbound payments to signed intents — never by static destination reuse.
 * Unmatched inbounds are flagged (never silently accepted).
 */
import { randomNonce } from "../services/crypto.js";
import type { Store } from "../services/store.js";
import { saveStore } from "../services/store.js";
import { receivePayState } from "./state.js";
import type {
  InboundObservation,
  MintedDestination,
  ReceiveFailureReason,
  UnmatchedInbound,
} from "./types.js";

function flagUnmatched(
  store: Store,
  entry: Omit<UnmatchedInbound, "unmatched_id" | "flagged_at">
): UnmatchedInbound {
  const s = receivePayState(store);
  const unmatched: UnmatchedInbound = {
    unmatched_id: `unm_${randomNonce(8)}`,
    flagged_at: Date.now(),
    ...entry,
  };
  s.unmatched.push(unmatched);
  saveStore(store);
  return unmatched;
}

export function listUnmatched(store: Store): UnmatchedInbound[] {
  return [...receivePayState(store).unmatched];
}

export function observeInbound(
  store: Store,
  input: {
    order_reference?: string;
    payment_ref: string;
    amount: number;
    currency?: string;
    settlement_destination?: string;
  }
):
  | { ok: true; observation: InboundObservation; destination: MintedDestination }
  | {
      ok: false;
      reason: ReceiveFailureReason;
      detail?: string;
      unmatched?: UnmatchedInbound;
    } {
  const s = receivePayState(store);
  const order_reference = String(input.order_reference || "").trim();

  // Orphan inbound — destination/payment with no signed intent
  if (!order_reference || !s.by_order_ref[order_reference]) {
    const unmatched = flagUnmatched(store, {
      payment_ref: String(input.payment_ref),
      settlement_destination: input.settlement_destination,
      order_reference: order_reference || undefined,
      amount: Number(input.amount),
      currency: input.currency,
      reason: "no_signed_intent",
      detail: "Payment arrived with no matching signed intent for order_ref",
    });
    return {
      ok: false,
      reason: "unmatched_inbound",
      detail: unmatched.detail,
      unmatched,
    };
  }

  const destId = s.by_order_ref[order_reference];
  const destination = s.destinations.find((d) => d.destination_id === destId);
  if (!destination) {
    const unmatched = flagUnmatched(store, {
      payment_ref: String(input.payment_ref),
      order_reference,
      amount: Number(input.amount),
      reason: "no_signed_intent",
    });
    return { ok: false, reason: "order_not_found", unmatched };
  }

  if (
    input.settlement_destination &&
    input.settlement_destination !== destination.settlement_destination
  ) {
    const unmatched = flagUnmatched(store, {
      payment_ref: String(input.payment_ref),
      settlement_destination: input.settlement_destination,
      order_reference,
      amount: Number(input.amount),
      currency: input.currency,
      reason: "destination_mismatch",
      detail: "Inbound destination does not match JIT mint for this order_ref",
    });
    return {
      ok: false,
      reason: "destination_reuse_attempt",
      detail: unmatched.detail,
      unmatched,
    };
  }

  if (Number(input.amount) !== destination.amount) {
    const unmatched = flagUnmatched(store, {
      payment_ref: String(input.payment_ref),
      settlement_destination: destination.settlement_destination,
      order_reference,
      amount: Number(input.amount),
      currency: input.currency,
      reason: "amount_mismatch",
      detail: `Expected ${destination.amount}, got ${input.amount}`,
    });
    return {
      ok: false,
      reason: "amount_mismatch",
      detail: unmatched.detail,
      unmatched,
    };
  }
  if (input.currency && input.currency.toUpperCase() !== destination.currency) {
    const unmatched = flagUnmatched(store, {
      payment_ref: String(input.payment_ref),
      order_reference,
      amount: Number(input.amount),
      currency: input.currency,
      reason: "amount_mismatch",
      detail: "Currency mismatch",
    });
    return { ok: false, reason: "amount_mismatch", detail: "Currency mismatch", unmatched };
  }

  // Duplicate inbound for same order_ref after already observed
  const prior = s.observations.find((o) => o.order_reference === order_reference);
  if (prior && prior.payment_ref !== String(input.payment_ref)) {
    const unmatched = flagUnmatched(store, {
      payment_ref: String(input.payment_ref),
      order_reference,
      amount: Number(input.amount),
      reason: "duplicate_attempt",
      detail: "Duplicate inbound for an order_ref that already has an observation",
    });
    return {
      ok: false,
      reason: "unmatched_inbound",
      detail: unmatched.detail,
      unmatched,
    };
  }

  const observation: InboundObservation = {
    observation_id: `obs_${randomNonce(8)}`,
    destination_id: destination.destination_id,
    order_reference: destination.order_reference,
    intent_commitment: destination.intent_commitment,
    payment_ref: String(input.payment_ref),
    amount: Number(input.amount),
    currency: destination.currency,
    observed_at: Date.now(),
  };

  if (!prior) s.observations.push(observation);
  if (destination.status === "minted") destination.status = "inbound_detected";
  saveStore(store);
  return { ok: true, observation: prior ?? observation, destination };
}

export function reconcileByOrderRef(
  store: Store,
  order_reference: string
):
  | {
      ok: true;
      destination: MintedDestination;
      observation: InboundObservation;
    }
  | { ok: false; reason: ReceiveFailureReason; detail?: string } {
  const s = receivePayState(store);
  const destId = s.by_order_ref[order_reference];
  if (!destId) return { ok: false, reason: "order_not_found" };

  const destination = s.destinations.find((d) => d.destination_id === destId)!;
  const observation = [...s.observations]
    .reverse()
    .find((o) => o.order_reference === order_reference);

  if (!observation) {
    return {
      ok: false,
      reason: "not_reconciled",
      detail: "No inbound payment observed for this order_reference",
    };
  }

  if (
    destination.status === "reconciled" ||
    destination.status === "confirmed" ||
    destination.status === "credited"
  ) {
    return { ok: true, destination, observation };
  }

  destination.status = "reconciled";
  saveStore(store);
  return { ok: true, destination, observation };
}
