/**
 * Money-in / money-out hub — honest rail status for the product.
 * Real adapters live under txAuth/rails; this surfaces pilot readiness.
 */
import { listSettlementRails } from "../txAuth/settlement.js";

export type RailStatus = {
  id: string;
  label: string;
  direction: "in" | "out" | "both";
  readiness: "live_pilot" | "adapter_stub" | "planned";
  note: string;
};

export function listProductRails(): RailStatus[] {
  const txRails = listSettlementRails();
  const base: RailStatus[] = [
    {
      id: "circle_unit_topup",
      label: "CIRCLE unit top-up",
      direction: "in",
      readiness: "live_pilot",
      note: "Reseals Compact balance commitment — product/testnet funding, not bank ACH",
    },
    {
      id: "internal_ledger",
      label: "CIRCLE internal ledger",
      direction: "both",
      readiness: "live_pilot",
      note: "quote/reserve/settle/refund sandbox — pilot money movement for CIRCLE units",
    },
    {
      id: "sandbox_psp",
      label: "Sandbox PSP (HMAC webhooks)",
      direction: "both",
      readiness: "live_pilot",
      note: "Full lifecycle + webhook ack — NOT a licensed UPI/bank/card rail",
    },
    {
      id: "offramp_stub",
      label: "Bank / UPI off-ramp",
      direction: "out",
      readiness: "adapter_stub",
      note: "Licensed PSP not wired — use sandbox_psp for pilot contract tests",
    },
    {
      id: "midnight_preprod",
      label: "Midnight Preprod broadcast",
      direction: "both",
      readiness: "live_pilot",
      note: "Optional when wallet + contract env configured; fees in tDUST",
    },
  ];
  for (const id of txRails) {
    if (base.some((b) => b.id === id)) continue;
    base.push({
      id,
      label: id.toUpperCase(),
      direction: "out",
      readiness: id === "internal_ledger" ? "live_pilot" : "adapter_stub",
      note:
        id === "internal_ledger"
          ? "Sandbox ledger with full lifecycle API"
          : "Rail-agnostic tx-auth adapter registered — authorize then settle at edge",
    });
  }
  return base;
}

export function railsHubDocument() {
  return {
    title: "CircleProof rails hub",
    asset: {
      id: "CIRCLE_UNIT",
      networkFeeAsset: "tDUST",
      oneLiner:
        "Class 0 CIRCLE product units; Compact commitments on Midnight; not INR/UPI/USDC yet",
    },
    rails: listProductRails(),
  };
}
