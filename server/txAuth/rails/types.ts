/**
 * Thin rail adapters — edge translation only.
 * Circuit / registry / intent commitment never import these types' rail semantics.
 * destination is always OpaqueDestination (plain string at the proof boundary).
 */
import type { OpaqueDestination, SettlementReceipt, SettlementRequest } from "../types.js";

export type RailAdapter = {
  /** Stable rail id used in TransactionIntent.settlement_rail (opaque to circuit) */
  id: string;
  /** Human label for ops — never read by circuit */
  label: string;
  /**
   * Mint a fresh opaque destination string for this rail.
   * Must be unique per (merchant, order_ref, nonce) — never a static merchant address.
   */
  mintDestination(input: {
    merchant_identifier: string;
    order_reference: string;
    nonce: string;
  }): OpaqueDestination;
  /** Optional native-format validation before settle (edge only) */
  validateDestination?(destination: OpaqueDestination): boolean;
  /** Post-authorization settlement on this rail */
  settle(req: SettlementRequest): Promise<SettlementReceipt>;
};
