import { randomNonce } from "../../services/crypto.js";
import type { Store } from "../../services/store.js";
import { saveStore } from "../../services/store.js";
import { CLASS3_RETENTION_MS } from "../classification.js";
import { midnightSettlementMeta } from "../../services/midnight.js";

export interface RelayOpsLog {
  id: string;
  kind: "submit" | "release" | "decoy" | "purge";
  timestamp: number;
  /** No per-user identifier — Class 3 only */
  dataClass: 3;
  detail?: string;
}

/**
 * Settlement Relay (§1 / §7)
 * Touches: committed payloads + timing
 * Must NOT touch: transaction content
 */
export class SettlementRelayService {
  constructor(private store: Store) {}

  log(kind: RelayOpsLog["kind"], detail?: string) {
    if (!this.store.relayOpsLogs) this.store.relayOpsLogs = [];
    this.store.relayOpsLogs.push({
      id: randomNonce(6),
      kind,
      timestamp: Date.now(),
      dataClass: 3,
      detail,
    });
  }

  flush() {
    const now = Date.now();
    let changed = false;
    for (const e of this.store.events) {
      if (!e.released && e.delayedUntil <= now) {
        e.released = true;
        changed = true;
        this.log("release", e.type);
      }
    }
    if (changed) saveStore(this.store);
  }

  emitDecoy() {
    const delayMs = 2000 + Math.floor(Math.random() * 8000);
    this.store.events.push({
      id: randomNonce(8),
      type: "decoy",
      timestamp: Date.now(),
      delayedUntil: Date.now() + delayMs,
      released: false,
      meta: midnightSettlementMeta({ note: "null-state decoy — Class 3 timing only" }),
    });
    this.log("decoy");
    saveStore(this.store);
  }

  /** Purge Class 3 ops logs past retention window */
  purgeClass3(now = Date.now()) {
    if (!this.store.relayOpsLogs) return 0;
    const before = this.store.relayOpsLogs.length;
    this.store.relayOpsLogs = this.store.relayOpsLogs.filter(
      (l) => now - l.timestamp < CLASS3_RETENTION_MS
    );
    const removed = before - this.store.relayOpsLogs.length;
    if (removed) {
      this.log("purge", `removed ${removed} Class 3 entries`);
      saveStore(this.store);
    }
    return removed;
  }

  publicStats() {
    this.flush();
    return {
      pendingInRelay: this.store.events.filter((e) => !e.released).length,
      releasedEvents: this.store.events.filter((e) => e.released).length,
      class3LogCount: this.store.relayOpsLogs?.length ?? 0,
      retentionMs: CLASS3_RETENTION_MS,
      note: "Jittered relay + decoys — traffic-analysis mitigation, not a proof",
    };
  }
}
