/**
 * Phase 8 — Challenge management (random, single-use, time-bounded).
 */
import { randomNonce, sha256 } from "../services/crypto.js";
import type { Store } from "../services/store.js";
import { saveStore } from "../services/store.js";
import { txAuthState } from "./registry.js";
import type { PlatformChallenge } from "./types.js";

export const CHALLENGE_TTL_MS = 5 * 60 * 1000;

export function issueChallenge(
  store: Store,
  input: { intent_commitment: string; agent_session_id?: string }
): PlatformChallenge {
  if (!/^[a-f0-9]{64}$/i.test(input.intent_commitment)) {
    throw new Error("malformed_commitment");
  }
  const s = txAuthState(store);
  const issued_at = Date.now();
  const expires_at = issued_at + CHALLENGE_TTL_MS;
  const time_window = `${issued_at}:${expires_at}`;
  const nonce = randomNonce(16);
  const agent_session_id = input.agent_session_id || randomNonce(12);
  const platform_challenge = sha256(
    `a26z:txchal:${nonce}|${agent_session_id}|${time_window}|${input.intent_commitment}`
  );
  const challenge_id = `txchal_${nonce.slice(0, 14)}`;

  const challenge: PlatformChallenge = {
    challenge_id,
    platform_challenge,
    agent_session_id,
    time_window,
    issued_at,
    expires_at,
    intent_commitment: input.intent_commitment,
  };

  s.challenges[challenge_id] = challenge;
  saveStore(store);
  return challenge;
}

export function consumeChallenge(
  store: Store,
  challenge_id: string
):
  | { ok: true; challenge: PlatformChallenge }
  | { ok: false; reason: "challenge_mismatch_or_expired"; detail: string } {
  const s = txAuthState(store);
  const chal = s.challenges[challenge_id];
  if (!chal) {
    return { ok: false, reason: "challenge_mismatch_or_expired", detail: "Unknown challenge" };
  }
  if (Date.now() > chal.expires_at) {
    delete s.challenges[challenge_id];
    s.metrics.challenge_expired_count += 1;
    saveStore(store);
    return { ok: false, reason: "challenge_mismatch_or_expired", detail: "Challenge expired" };
  }
  if (s.spent_challenges.includes(challenge_id)) {
    return {
      ok: false,
      reason: "challenge_mismatch_or_expired",
      detail: "Challenge already consumed (replay)",
    };
  }
  s.spent_challenges.push(challenge_id);
  delete s.challenges[challenge_id];
  saveStore(store);
  return { ok: true, challenge: chal };
}

export function peekChallenge(store: Store, challenge_id: string): PlatformChallenge | null {
  return txAuthState(store).challenges[challenge_id] ?? null;
}
