/**
 * Settlement confirmation — merchant signs intent_commitment after matching payment.
 * Closes the loop back to the buyer's agent.
 */
import { hmacVerify, randomNonce } from "../services/crypto.js";
import { getMerchantSigner } from "../services/merchantHsm.js";
import { openSecret } from "../services/secretBox.js";
import type { Store } from "../services/store.js";
import { saveStore } from "../services/store.js";
import { findMerchant } from "../txAuth/registry.js";
import { reconcileByOrderRef } from "./reconcile.js";
import { receivePayState } from "./state.js";
import type { ReceiveFailureReason, SettlementConfirmation } from "./types.js";

function confirmMessage(intent_commitment: string, order_reference: string): string {
  return `settle-confirm:${intent_commitment}|${order_reference}`;
}

export async function issueSettlementConfirmation(
  store: Store,
  input: { order_reference: string }
): Promise<
  | { ok: true; confirmation: SettlementConfirmation }
  | { ok: false; reason: ReceiveFailureReason; detail?: string }
> {
  const reconciled = reconcileByOrderRef(store, input.order_reference);
  if (!reconciled.ok) return reconciled;

  const { destination } = reconciled;
  if (destination.status === "confirmed" || destination.status === "credited") {
    const existing = receivePayState(store).confirmations.find(
      (c) => c.order_reference === input.order_reference
    );
    if (existing) return { ok: true, confirmation: existing };
  }
  if (destination.status !== "reconciled" && destination.status !== "inbound_detected") {
    // ensure reconciled
    if (destination.status === "minted") {
      return { ok: false, reason: "not_reconciled" };
    }
  }

  // Force reconcile status
  if (destination.status === "inbound_detected") {
    destination.status = "reconciled";
  }

  const merchant = findMerchant(store, destination.merchant_identifier);
  if (!merchant) return { ok: false, reason: "merchant_not_found" };

  const confirmation_signature = await getMerchantSigner().sign({
    merchant_identifier: merchant.merchant_identifier,
    sealed_secret: merchant.merchant_secret,
    message: confirmMessage(destination.intent_commitment, destination.order_reference),
  });

  const confirmation: SettlementConfirmation = {
    confirmation_id: `cfm_${randomNonce(8)}`,
    intent_commitment: destination.intent_commitment,
    order_reference: destination.order_reference,
    merchant_identifier: merchant.merchant_identifier,
    destination_id: destination.destination_id,
    confirmation_signature,
    confirmed_at: Date.now(),
  };

  destination.status = "confirmed";
  receivePayState(store).confirmations.push(confirmation);
  saveStore(store);
  return { ok: true, confirmation };
}

export function verifySettlementConfirmation(
  store: Store,
  confirmation: SettlementConfirmation
): { ok: true } | { ok: false; reason: ReceiveFailureReason } {
  const merchant = findMerchant(store, confirmation.merchant_identifier, {
    includeRevoked: true,
  });
  if (!merchant) return { ok: false, reason: "merchant_not_found" };
  const ok = hmacVerify(
    openSecret(merchant.merchant_secret),
    confirmMessage(confirmation.intent_commitment, confirmation.order_reference),
    confirmation.confirmation_signature
  );
  return ok ? { ok: true } : { ok: false, reason: "confirmation_invalid" };
}
