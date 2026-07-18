/**
 * Just-in-time destination minting — fresh destination per transaction intent.
 * Destinations are burned at mint; reuse across two transactions is impossible.
 */
import { randomNonce } from "../services/crypto.js";
import type { Store } from "../services/store.js";
import { saveStore } from "../services/store.js";
import { commitIntent } from "../txAuth/intent.js";
import { resolveRailAdapter } from "../txAuth/rails/registry.js";
import { ensureDemoMerchants, findMerchant } from "../txAuth/registry.js";
import type { TransactionIntent } from "../txAuth/types.js";
import { receivePayState } from "./state.js";
import type { MintedDestination, ReceiveFailureReason } from "./types.js";

export function mintDestination(
  store: Store,
  input: {
    intent: Omit<TransactionIntent, "settlement_destination"> & {
      settlement_destination?: string;
    };
    intent_commitment?: string;
  }
):
  | { ok: true; destination: MintedDestination; intent: TransactionIntent; intent_commitment: string }
  | { ok: false; reason: ReceiveFailureReason; detail?: string } {
  ensureDemoMerchants(store);
  const merchant = findMerchant(store, input.intent.merchant_identifier);
  if (!merchant) return { ok: false, reason: "merchant_not_found" };

  const order_reference = String(input.intent.order_reference || "").trim();
  if (!order_reference || !input.intent.amount || !input.intent.currency || !input.intent.settlement_rail) {
    return { ok: false, reason: "missing_required_fields" };
  }

  const s = receivePayState(store);
  if (s.by_order_ref[order_reference]) {
    return {
      ok: false,
      reason: "already_reconciled",
      detail: "order_reference already has a minted destination",
    };
  }

  // Fresh destination via rail adapter (edge) — circuit sees only opaque string
  const destNonce = randomNonce(16);
  const adapter = resolveRailAdapter(String(input.intent.settlement_rail));
  const settlement_destination = adapter.mintDestination({
    merchant_identifier: merchant.merchant_identifier,
    order_reference,
    nonce: destNonce,
  });

  if (s.spent_destinations.includes(settlement_destination)) {
    return { ok: false, reason: "destination_reuse_attempt" };
  }

  const intent: TransactionIntent = {
    merchant_identifier: merchant.merchant_identifier,
    order_reference,
    amount: Number(input.intent.amount),
    currency: String(input.intent.currency).toUpperCase(),
    settlement_rail: String(input.intent.settlement_rail),
    settlement_destination,
    nonce: input.intent.nonce || randomNonce(16),
    timestamp: input.intent.timestamp || Date.now(),
  };

  let intent_commitment: string;
  try {
    intent_commitment = input.intent_commitment || commitIntent(intent).intent_commitment;
    if (input.intent_commitment) {
      const expected = commitIntent(intent).intent_commitment;
      if (expected !== input.intent_commitment) {
        return { ok: false, reason: "intent_commitment_mismatch" };
      }
    }
  } catch (e) {
    return {
      ok: false,
      reason: "missing_required_fields",
      detail: e instanceof Error ? e.message : String(e),
    };
  }

  const destination: MintedDestination = {
    destination_id: `dest_${destNonce.slice(0, 14)}`,
    settlement_destination,
    order_reference,
    intent_commitment,
    merchant_identifier: merchant.merchant_identifier,
    amount: intent.amount,
    currency: intent.currency,
    settlement_rail: intent.settlement_rail,
    minted_at: Date.now(),
    status: "minted",
    destination_spent: true,
  };

  s.spent_destinations.push(settlement_destination);
  s.destinations.push(destination);
  s.by_order_ref[order_reference] = destination.destination_id;
  saveStore(store);

  return { ok: true, destination, intent, intent_commitment };
}

export function assertDestinationUnused(store: Store, settlement_destination: string): boolean {
  return !receivePayState(store).spent_destinations.includes(settlement_destination);
}
