import { randomNonce } from "../../services/crypto.js";
import type { Store } from "../../services/store.js";
import { saveStore } from "../../services/store.js";
import { KycRegistryWriter } from "./kycRegistry.js";

export type RevocationReasonCode =
  | "FRAUD"
  | "COURT_ORDER"
  | "SANCTIONS_UPDATE"
  | "SANCTIONS_STALE"
  | "USER_REQUEST"
  | "OTHER";

export interface RevocationEvent {
  id: string;
  nullifier: string;
  reasonCode: RevocationReasonCode;
  timestamp: number;
  /** Never includes user identity — structurally unlinkable without private preimage */
  dataClass: 1;
}

/**
 * Revocation Service (§1 / §4)
 * Touches: nullifier, timestamp, reason code
 * Must NOT touch / derive: which user the nullifier corresponds to
 */
export class RevocationService {
  constructor(private store: Store) {}

  revokeByNullifier(
    nullifier: string,
    reasonCode: RevocationReasonCode
  ): RevocationEvent {
    if (!this.store.revokedNullifiers.includes(nullifier)) {
      this.store.revokedNullifiers.push(nullifier);
    }
    const leaf = this.store.kycLeaves.find((l) => l.nullifier === nullifier);
    if (leaf) leaf.revoked = true;

    new KycRegistryWriter(this.store).recomputeRoot();

    const event: RevocationEvent = {
      id: randomNonce(8),
      nullifier,
      reasonCode,
      timestamp: Date.now(),
      dataClass: 1,
    };
    if (!this.store.revocationEvents) this.store.revocationEvents = [];
    this.store.revocationEvents.push(event);

    this.store.events.push({
      id: randomNonce(8),
      type: "kyc_commit",
      timestamp: Date.now(),
      delayedUntil: Date.now(),
      released: true,
      meta: {
        note: "revocation nullifier published — no user identity",
        reasonCode,
        nullifierHint: `${nullifier.slice(0, 10)}…`,
      },
    });

    saveStore(this.store);
    return event;
  }

  /** Public revoked set size — audit-safe */
  publicStats() {
    return {
      revokedNullifierCount: this.store.revokedNullifiers.length,
      events: (this.store.revocationEvents ?? []).slice(-20).map((e) => ({
        id: e.id,
        nullifierHint: `${e.nullifier.slice(0, 10)}…`,
        reasonCode: e.reasonCode,
        timestamp: e.timestamp,
      })),
    };
  }
}
