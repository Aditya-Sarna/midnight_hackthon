/**
 * Phase 8 live-test rail — PIX (Brazil).
 */
import { sha256 } from "../../services/crypto.js";
import { asOpaqueDestination, type OpaqueDestination } from "../types.js";
import type { SettlementReceipt, SettlementRequest } from "../types.js";
import type { RailAdapter } from "./types.js";
import { settleStubRail } from "./stubGuard.js";

export const pixAdapter: RailAdapter = {
  id: "pix",
  label: "PIX (Brazil)",
  mintDestination(input) {
    const digest = sha256(
      `rail:pix:${input.merchant_identifier}|${input.order_reference}|${input.nonce}`
    );
    return asOpaqueDestination(`pix_${digest.slice(0, 36)}`);
  },
  validateDestination(destination: OpaqueDestination) {
    return destination.startsWith("pix_") && destination.length >= 12;
  },
  async settle(req: SettlementRequest): Promise<SettlementReceipt> {
    return settleStubRail("pix", req);
  },
};
