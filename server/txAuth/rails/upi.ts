import { sha256 } from "../../services/crypto.js";
import { asOpaqueDestination, type OpaqueDestination } from "../types.js";
import type { SettlementReceipt, SettlementRequest } from "../types.js";
import type { RailAdapter } from "./types.js";
import { settleStubRail } from "./stubGuard.js";

/** UPI adapter — VPA / collect-request reference as opaque destination. */
export const upiAdapter: RailAdapter = {
  id: "upi",
  label: "UPI",
  mintDestination(input) {
    const digest = sha256(
      `rail:upi:${input.merchant_identifier}|${input.order_reference}|${input.nonce}`
    );
    return asOpaqueDestination(`vpa_${digest.slice(0, 12)}@nykpay`);
  },
  validateDestination(destination: OpaqueDestination) {
    return destination.includes("@") && destination.length >= 8;
  },
  async settle(req: SettlementRequest): Promise<SettlementReceipt> {
    return settleStubRail("upi", req);
  },
};
