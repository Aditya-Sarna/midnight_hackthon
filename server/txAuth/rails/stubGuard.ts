/**
 * Fail-closed stub rail settlement under production strict mode.
 * Real PSP/UPI/card adapters replace these; demos set NYXPAY_ALLOW_STUB_RAILS=1.
 */
import { loadConfig } from "../../config.js";
import { randomNonce } from "../../services/crypto.js";
import type { SettlementReceipt, SettlementRequest } from "../types.js";

export function settleStubRail(
  rail: string,
  req: SettlementRequest
): SettlementReceipt {
  const cfg = loadConfig();
  if (
    cfg.isStrict &&
    process.env.NYXPAY_ALLOW_STUB_RAILS !== "1" &&
    process.env.NYXPAY_BOOT_SOFT !== "1" &&
    !process.env.VITEST
  ) {
    return {
      ok: false,
      rail,
      settlement_id: `blocked_${rail}`,
      routed_at: new Date().toISOString(),
      note: `Stub ${rail} rail blocked in production — wire a real adapter or set NYXPAY_ALLOW_STUB_RAILS=1`,
    };
  }
  return {
    ok: true,
    rail,
    settlement_id: `stl_${rail}_${randomNonce(8)}`,
    routed_at: new Date().toISOString(),
    note: `${rail.toUpperCase()} stub accepted for ${req.intent_commitment.slice(0, 16)}…`,
  };
}
