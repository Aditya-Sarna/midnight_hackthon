import { sha256 } from "../../services/crypto.js";
import { asOpaqueDestination, type OpaqueDestination } from "../types.js";
import type { SettlementReceipt, SettlementRequest } from "../types.js";
import type { RailAdapter } from "./types.js";
import { settleStubRail } from "./stubGuard.js";

/** Crypto adapter — address/invoice shaped opaque destination; settlement is chain/Lightning-side. */
export function createCryptoAdapter(id: string, label: string): RailAdapter {
  return {
    id,
    label,
    mintDestination(input) {
      const digest = sha256(
        `rail:crypto:${id}:${input.merchant_identifier}|${input.order_reference}|${input.nonce}`
      );
      return asOpaqueDestination(`inv_${id}_${digest.slice(0, 40)}`);
    },
    validateDestination(destination: OpaqueDestination) {
      return destination.startsWith(`inv_${id}_`) && destination.length > 12;
    },
    async settle(req: SettlementRequest): Promise<SettlementReceipt> {
      return settleStubRail(id, req);
    },
  };
}
