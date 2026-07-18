/**
 * Agent SDK — Phase 10 receiving-payment.
 */
import { req } from "./api.js";

const BASE = "/skills/receiving-payment";

export async function mintDestination(input: {
  merchant_identifier: string;
  order_reference: string;
  amount: number;
  currency: string;
  settlement_rail: string;
}) {
  return req<{
    destination: { settlement_destination: string; destination_id: string; order_reference: string };
    intent_commitment: string;
  }>(`${BASE}/mint-destination`, { method: "POST", body: JSON.stringify(input) });
}

export async function reconcileByOrderRef(order_reference: string) {
  return req(`${BASE}/reconcile`, {
    method: "POST",
    body: JSON.stringify({ order_reference }),
  });
}

export async function confirmSettlement(order_reference: string) {
  return req(`${BASE}/confirm`, {
    method: "POST",
    body: JSON.stringify({ order_reference }),
  });
}

export async function creditPrivateBalance(input: {
  order_reference: string;
  old_balance_commitment: string;
  new_balance_commitment: string;
  merchant_account_id?: string;
}) {
  return req(`${BASE}/credit`, { method: "POST", body: JSON.stringify(input) });
}

export async function receivePayment(input: {
  merchant_identifier: string;
  order_reference: string;
  amount: number;
  currency: string;
  settlement_rail: string;
  run_credit?: boolean;
}) {
  return req<{
    ok: boolean;
    exit_criterion: {
      received: boolean;
      reconciled_by_order_ref: boolean;
      settlement_confirmed: boolean;
      private_balance_credited: boolean;
      destination_never_reused: boolean;
    };
  }>(`${BASE}/receive`, { method: "POST", body: JSON.stringify(input) });
}

export async function getReceivePaySkillDocument() {
  return req<Record<string, unknown>>(BASE);
}
