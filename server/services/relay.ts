import { randomNonce } from "./crypto.js";
import type { Store } from "./store.js";
import { saveStore } from "./store.js";

/** Release delayed relay events whose jitter window has elapsed */
export function flushRelay(store: Store) {
  const now = Date.now();
  let changed = false;
  for (const e of store.events) {
    if (!e.released && e.delayedUntil <= now) {
      e.released = true;
      changed = true;
    }
  }
  if (changed) saveStore(store);
}

/** Periodic structurally-indistinguishable decoy traffic (§7) */
export function emitPeriodicDecoy(store: Store) {
  const delayMs = 2000 + Math.floor(Math.random() * 8000);
  store.events.push({
    id: randomNonce(8),
    type: "decoy",
    timestamp: Date.now(),
    delayedUntil: Date.now() + delayMs,
    released: false,
    meta: { note: "periodic null-state decoy — traffic-analysis mitigation, not a proof" },
  });
  saveStore(store);
}

export function publicLedger(store: Store) {
  flushRelay(store);
  return {
    kycRegistryRoot: store.kycRoot,
    spentNullifierCount: store.spentNullifiers.length,
    revokedNullifierCount: store.revokedNullifiers.length,
    events: store.events
      .filter((e) => e.released)
      .slice(-40)
      .reverse()
      .map((e) => ({
        id: e.id,
        type: e.type,
        timestamp: e.timestamp,
        nullifier: e.nullifier ? `${e.nullifier.slice(0, 10)}…` : undefined,
        newBalanceCommitment: e.newBalanceCommitment
          ? `${e.newBalanceCommitment.slice(0, 10)}…`
          : undefined,
        note: e.meta?.note,
      })),
    pendingInRelay: store.events.filter((e) => !e.released).length,
  };
}
