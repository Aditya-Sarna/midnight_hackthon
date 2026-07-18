import { randomNonce, sha256 } from "../../services/crypto.js";
import type { Store } from "../../services/store.js";
import { saveStore } from "../../services/store.js";

export interface EnrollmentSession {
  sessionToken: string;
  ephemeralPubkeyA: string;
  ephemeralPubkeyB?: string;
  expiresAt: number;
  /** Stateless after handshake — no names/addresses stored */
  dataClass: 3;
}

/**
 * Recipient Enrollment Relay (§1)
 * Touches: ephemeral session tokens, pubkeys, expiry
 * Must NOT touch: contact names, addresses, post-handshake data
 */
export class EnrollmentRelayService {
  constructor(private store: Store) {}

  beginHandshake(ephemeralPubkey: string): EnrollmentSession {
    this.purgeExpired();
    const session: EnrollmentSession = {
      sessionToken: randomNonce(16),
      ephemeralPubkeyA: ephemeralPubkey,
      expiresAt: Date.now() + 5 * 60 * 1000,
      dataClass: 3,
    };
    if (!this.store.enrollmentSessions) this.store.enrollmentSessions = [];
    this.store.enrollmentSessions.push(session);
    saveStore(this.store);
    return {
      sessionToken: session.sessionToken,
      ephemeralPubkeyA: session.ephemeralPubkeyA,
      expiresAt: session.expiresAt,
      dataClass: 3,
    };
  }

  completeHandshake(sessionToken: string, ephemeralPubkeyB: string) {
    this.purgeExpired();
    const sessions = this.store.enrollmentSessions ?? [];
    const idx = sessions.findIndex((s) => s.sessionToken === sessionToken);
    if (idx < 0) throw new Error("Enrollment session expired or unknown");
    const session = sessions[idx];
    if (Date.now() > session.expiresAt) {
      sessions.splice(idx, 1);
      saveStore(this.store);
      throw new Error("Enrollment session expired");
    }
    // Handshake complete — wipe session (stateless server-side)
    sessions.splice(idx, 1);
    saveStore(this.store);
    return {
      ok: true as const,
      handshakeId: sha256(`${session.ephemeralPubkeyA}|${ephemeralPubkeyB}`).slice(0, 16),
      note: "Session destroyed — no contact names or addresses retained",
    };
  }

  purgeExpired(now = Date.now()) {
    if (!this.store.enrollmentSessions) return;
    this.store.enrollmentSessions = this.store.enrollmentSessions.filter(
      (s) => s.expiresAt > now
    );
  }
}
