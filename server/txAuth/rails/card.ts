import { sha256 } from "../../services/crypto.js";
import { asOpaqueDestination, type OpaqueDestination } from "../types.js";
import type { SettlementReceipt, SettlementRequest } from "../types.js";
import type { RailAdapter } from "./types.js";
import { settleStubRail } from "./stubGuard.js";

/** Card adapter — tokenized destination reference (never PAN). */
export const cardAdapter: RailAdapter = {
  id: "card",
  label: "Card network",
  mintDestination(input) {
    const digest = sha256(
      `rail:card:${input.merchant_identifier}|${input.order_reference}|${input.nonce}`
    );
    return asOpaqueDestination(`tok_card_${digest.slice(0, 32)}`);
  },
  validateDestination(destination: OpaqueDestination) {
    return destination.startsWith("tok_card_") && destination.length >= 16;
  },
  async settle(req: SettlementRequest): Promise<SettlementReceipt> {
    return settleStubRail("card", req);
  },
};
