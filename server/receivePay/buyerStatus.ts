/**
 * Phase 6 — Buyer-agent payment states from confirmations alone.
 *   payment_sent                  — authorized / outbound initiated, no merchant confirmation
 *   payment_sent_not_yet_matched  — inbound may exist but confirmation not issued
 *   payment_received_and_matched  — merchant signed confirmation over intent_commitment
 */
import type { Store } from "../services/store.js";
import type { BuyerPaymentState } from "../txAuth/types.js";
import { receivePayState } from "./state.js";

export type BuyerStatusView = {
  intent_commitment: string;
  order_reference?: string;
  state: BuyerPaymentState;
  confirmation_id?: string;
  confirmed_at?: number;
  detail: string;
};

/**
 * Resolve buyer state for an intent_commitment.
 * `paymentSent` means the buyer/agent has already authorized and (optionally) settled outbound.
 */
export function resolveBuyerPaymentState(
  store: Store,
  input: {
    intent_commitment: string;
    /** Buyer claims payment was sent / authorized */
    payment_sent?: boolean;
  }
): BuyerStatusView {
  const s = receivePayState(store);
  const confirmation = s.confirmations.find(
    (c) => c.intent_commitment === input.intent_commitment
  );
  if (confirmation) {
    return {
      intent_commitment: input.intent_commitment,
      order_reference: confirmation.order_reference,
      state: "payment_received_and_matched",
      confirmation_id: confirmation.confirmation_id,
      confirmed_at: confirmation.confirmed_at,
      detail: "Merchant signed settlement confirmation over intent_commitment",
    };
  }

  const destination = s.destinations.find(
    (d) => d.intent_commitment === input.intent_commitment
  );
  const observation = destination
    ? s.observations.find((o) => o.order_reference === destination.order_reference)
    : undefined;

  if (observation || (destination && destination.status !== "minted")) {
    return {
      intent_commitment: input.intent_commitment,
      order_reference: destination?.order_reference,
      state: "payment_sent_not_yet_matched",
      detail: "Inbound observed or destination active, but settlement confirmation not yet signed",
    };
  }

  if (input.payment_sent !== false) {
    return {
      intent_commitment: input.intent_commitment,
      order_reference: destination?.order_reference,
      state: "payment_sent",
      detail: "Payment authorized/sent; awaiting merchant match and confirmation",
    };
  }

  return {
    intent_commitment: input.intent_commitment,
    order_reference: destination?.order_reference,
    state: "payment_sent_not_yet_matched",
    detail: "No confirmation and no clear sent signal",
  };
}
