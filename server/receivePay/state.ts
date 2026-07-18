import type { Store } from "../services/store.js";
import type { ReceivePayState } from "./types.js";

export function receivePayState(store: Store): ReceivePayState {
  if (!store.receivePay) {
    store.receivePay = {
      destinations: [],
      spent_destinations: [],
      observations: [],
      confirmations: [],
      unmatched: [],
      by_order_ref: {},
    };
  }
  // Migrate older stores
  if (!store.receivePay.unmatched) store.receivePay.unmatched = [];
  return store.receivePay;
}
