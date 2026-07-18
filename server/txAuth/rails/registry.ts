/**
 * Rail adapter registry — register adapters at the edge.
 * Adding a rail = registerAdapter(adapter) only. Never touch Compact / intent hash.
 */
import { createCryptoAdapter } from "./crypto.js";
import { upiAdapter } from "./upi.js";
import { cardAdapter } from "./card.js";
import { ibanAdapter } from "./iban.js";
import { pixAdapter } from "./pix.js";
import type { RailAdapter } from "./types.js";
import { asOpaqueDestination } from "../types.js";
import { sha256 } from "../../services/crypto.js";
import type { SettlementReceipt, SettlementRequest } from "../types.js";

const adapters = new Map<string, RailAdapter>();

function register(adapter: RailAdapter) {
  adapters.set(adapter.id.toLowerCase(), adapter);
}

// Phase 3 initial rails
register(createCryptoAdapter("ethereum", "Ethereum"));
register(createCryptoAdapter("midnight", "Midnight"));
register(createCryptoAdapter("bitcoin", "Bitcoin"));
register(createCryptoAdapter("solana", "Solana"));
register(upiAdapter);
register(cardAdapter);
register(ibanAdapter);
// Phase 8 — rail added after initial scope (adapter-only)
register(pixAdapter);
// Legacy alias
register({
  ...ibanAdapter,
  id: "bank_ach",
  label: "Bank ACH (IBAN-family)",
});

/** Register a new rail at runtime — Phase 8 exit criterion path */
export function registerRailAdapter(adapter: RailAdapter) {
  register(adapter);
}

export function getRailAdapter(railId: string): RailAdapter | undefined {
  return adapters.get(railId.toLowerCase());
}

export function listRailAdapters(): Array<{ id: string; label: string }> {
  return [...adapters.values()].map((a) => ({ id: a.id, label: a.label }));
}

export function listRailIds(): string[] {
  return [...adapters.keys()];
}

/** Fallback for unknown rails — still opaque destination, still no circuit change */
export function fallbackAdapter(railId: string): RailAdapter {
  const id = railId || "unknown";
  return {
    id,
    label: `Generic (${id})`,
    mintDestination(input) {
      const digest = sha256(
        `rail:generic:${id}:${input.merchant_identifier}|${input.order_reference}|${input.nonce}`
      );
      return asOpaqueDestination(`jit_${id}_${digest.slice(0, 40)}`);
    },
    async settle(req: SettlementRequest): Promise<SettlementReceipt> {
      const { settleStubRail } = await import("./stubGuard.js");
      return settleStubRail(id, req);
    },
  };
}

export function resolveRailAdapter(railId: string): RailAdapter {
  return getRailAdapter(railId) ?? fallbackAdapter(railId);
}
