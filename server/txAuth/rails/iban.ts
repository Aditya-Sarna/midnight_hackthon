import { sha256 } from "../../services/crypto.js";
import { asOpaqueDestination, type OpaqueDestination } from "../types.js";
import type { SettlementReceipt, SettlementRequest } from "../types.js";
import type { RailAdapter } from "./types.js";
import { settleStubRail } from "./stubGuard.js";

/** IBAN adapter — account/routing reference as opaque destination. */
export const ibanAdapter: RailAdapter = {
  id: "iban",
  label: "IBAN / SEPA",
  mintDestination(input) {
    const digest = sha256(
      `rail:iban:${input.merchant_identifier}|${input.order_reference}|${input.nonce}`
    );
    return asOpaqueDestination(`iban_ref_${digest.slice(0, 28)}`);
  },
  validateDestination(destination: OpaqueDestination) {
    return destination.startsWith("iban_ref_") && destination.length >= 16;
  },
  async settle(req: SettlementRequest): Promise<SettlementReceipt> {
    return settleStubRail("iban", req);
  },
};
