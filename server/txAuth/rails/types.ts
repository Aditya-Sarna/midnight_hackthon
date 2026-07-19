/**
 * Thin rail adapters — edge translation only.
 * Circuit / registry / intent commitment never import these types' rail semantics.
 * destination is always OpaqueDestination (plain string at the proof boundary).
 */
import type { OpaqueDestination, SettlementReceipt, SettlementRequest } from "../types.js";

export type RailQuote = {
  ok: boolean;
  quoteId: string;
  rail: string;
  expiresAt: number;
  note?: string;
  sourceAsset?: string;
  targetAsset?: string;
  sourceAmount?: string;
  targetAmount?: string;
  feeAmount?: string;
  rate?: string;
};

export type RailReserve = {
  ok: boolean;
  reserveId: string;
  rail: string;
  expiresAt: number;
  note?: string;
};

export type RailStatusView = {
  ok: boolean;
  rail: string;
  refId: string;
  status: string;
  updatedAt?: number;
  note?: string;
};

export type RailCapabilities = {
  sourceMethods: string[];
  targetMethods: string[];
  sourceAssets: string[];
  targetAssets: string[];
  canQuote: boolean;
  canReserve: boolean;
  canRefund: boolean;
  canWebhook: boolean;
  mock: boolean;
};

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

/** Pilot rails may expose full payment lifecycle methods */
export type ExtendedRailAdapter = RailAdapter & {
  capabilities?: () => RailCapabilities;
  quote?(req: SettlementRequest): Promise<RailQuote>;
  reserve?(req: SettlementRequest): Promise<RailReserve>;
  refund?(settlementId: string): Promise<SettlementReceipt>;
  status?(refId: string): Promise<RailStatusView>;
  reconcile?(refId: string): Promise<RailStatusView>;
  handleWebhook?(payload: unknown): Promise<RailStatusView>;
};
