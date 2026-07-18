/**
 * CircledProof — Midnight-based OTP replacement
 * Challenge-response proof-of-possession over existing KYC Merkle membership.
 * No transmittable secret; nonce burned on first verify.
 */
import { randomNonce, sha256 } from "./crypto.js";
import type { Store } from "./store.js";
import { saveStore } from "./store.js";

export const NYXPROOF_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

export type CircledProofChallenge = {
  nonce: string;
  relyingPartyId: string;
  timeWindow: string;
  /** challenge = hash(nonce, relying_party_id, time_window) — not secret */
  challenge: string;
  kycRegistryRoot: string;
  issuedAt: number;
  expiresAt: number;
  unlinkable: boolean;
  /** Optional stable handle — omitted when unlinkable */
  expectedUserId?: string;
};

export type SessionAuthProof = {
  protocol: string;
  circuit: "prove_session_auth";
  publicInputs: Record<string, string>;
  proof: string;
  verified?: boolean;
  generatedAt: number;
};

export async function buildChallengeHash(
  nonce: string,
  relyingPartyId: string,
  timeWindow: string
): Promise<string> {
  return sha256(`nyxproof:challenge:${nonce}|${relyingPartyId}|${timeWindow}`);
}

export function issueChallenge(
  store: Store,
  input: {
    relyingPartyId: string;
    unlinkable?: boolean;
    expectedUserId?: string;
    windowMs?: number;
  }
): CircledProofChallenge {
  const windowMs = input.windowMs ?? NYXPROOF_WINDOW_MS;
  const nonce = randomNonce(24);
  const issuedAt = Date.now();
  const expiresAt = issuedAt + windowMs;
  const timeWindow = `${issuedAt}:${expiresAt}`;
  const relyingPartyId = String(input.relyingPartyId);
  const challenge = sha256(`nyxproof:challenge:${nonce}|${relyingPartyId}|${timeWindow}`);

  if (!store.nyxproofChallenges) store.nyxproofChallenges = {};
  if (!store.spentChallenges) store.spentChallenges = [];

  const record: CircledProofChallenge = {
    nonce,
    relyingPartyId,
    timeWindow,
    challenge,
    kycRegistryRoot: store.kycRoot,
    issuedAt,
    expiresAt,
    unlinkable: Boolean(input.unlinkable),
    expectedUserId: input.unlinkable ? undefined : input.expectedUserId,
  };

  store.nyxproofChallenges[nonce] = record;
  saveStore(store);
  return record;
}

export function verifyAndBurn(
  store: Store,
  input: {
    nonce: string;
    challenge: string;
    relyingPartyId: string;
    timeWindow: string;
    sessionProof: SessionAuthProof;
    /** When not unlinkable, optional credential commitment for correlation */
    credentialCommitment?: string;
  }
): { ok: true; burned: true; unlinkable: boolean } | { ok: false; reason: string } {
  if (!store.spentChallenges) store.spentChallenges = [];
  if (!store.nyxproofChallenges) store.nyxproofChallenges = {};

  if (store.spentChallenges.includes(input.nonce)) {
    return { ok: false, reason: "Challenge nonce already burned (single-use)" };
  }

  const pending = store.nyxproofChallenges[input.nonce];
  if (!pending) {
    return { ok: false, reason: "Unknown challenge nonce" };
  }

  if (Date.now() > pending.expiresAt) {
    delete store.nyxproofChallenges[input.nonce];
    saveStore(store);
    return { ok: false, reason: "Challenge expired" };
  }

  if (pending.challenge !== input.challenge) {
    return { ok: false, reason: "Challenge mismatch" };
  }
  if (pending.relyingPartyId !== input.relyingPartyId) {
    return { ok: false, reason: "Relying party mismatch — phishing-bound proof rejected" };
  }
  if (pending.timeWindow !== input.timeWindow) {
    return { ok: false, reason: "Time window mismatch" };
  }

  const expected = sha256(
    `nyxproof:challenge:${input.nonce}|${input.relyingPartyId}|${input.timeWindow}`
  );
  if (expected !== input.challenge) {
    return { ok: false, reason: "Challenge hash invalid" };
  }

  const proof = input.sessionProof;
  if (!proof?.proof || proof.circuit !== "prove_session_auth") {
    return { ok: false, reason: "Missing prove_session_auth proof" };
  }

  const pi = proof.publicInputs ?? {};
  if (pi.challenge !== input.challenge) {
    return { ok: false, reason: "Proof not bound to this challenge" };
  }
  const rpHash = sha256(`rp:${input.relyingPartyId}`);
  if (pi.relying_party_id !== rpHash) {
    return { ok: false, reason: "Proof not bound to this relying party" };
  }
  if (pi.kyc_registry_root !== store.kycRoot) {
    return { ok: false, reason: "KYC registry root mismatch" };
  }
  const twHash = sha256(input.timeWindow);
  if (pi.time_window !== twHash) {
    return { ok: false, reason: "Proof not bound to this time window" };
  }

  // Revocation: if a credential commitment is supplied, ensure leaf not revoked
  if (input.credentialCommitment) {
    const leaf = store.kycLeaves.find((l) => l.leaf === input.credentialCommitment);
    if (!leaf || leaf.revoked || store.revokedNullifiers.includes(leaf.nullifier)) {
      return { ok: false, reason: "Credential revoked" };
    }
  }

  // Burn nonce — single-use property without a transmittable code
  store.spentChallenges.push(input.nonce);
  delete store.nyxproofChallenges[input.nonce];

  store.events.push({
    id: randomNonce(8),
    type: "kyc_commit",
    timestamp: Date.now(),
    delayedUntil: Date.now(),
    released: true,
    meta: {
      note: "CircledProof session auth — challenge burned; no OTP transmitted",
      nyxproof: true,
      unlinkable: pending.unlinkable,
      relyingPartyHint: pending.relyingPartyId.slice(0, 24),
    },
  });

  saveStore(store);
  return { ok: true, burned: true, unlinkable: pending.unlinkable };
}

/**
 * Payment confirm-tap mode — challenge is derived from intent commitment
 * (no separate OTP channel; same tap carries prove_session_auth).
 */
export function verifyPaymentSessionAuth(
  store: Store,
  input: {
    intentCommitment: string;
    timeWindow: string;
    sessionProof: SessionAuthProof;
    credentialCommitment: string;
  }
): { ok: true; burned: true } | { ok: false; reason: string } {
  if (!store.spentChallenges) store.spentChallenges = [];
  const nonce = input.intentCommitment.slice(0, 48);
  const relyingPartyId = `circled:payment:${input.intentCommitment}`;
  const challenge = sha256(
    `nyxproof:challenge:${nonce}|${relyingPartyId}|${input.timeWindow}`
  );

  if (store.spentChallenges.includes(nonce)) {
    return { ok: false, reason: "Payment session challenge already burned" };
  }

  const [, exp] = input.timeWindow.split(":").map(Number);
  if (!exp || Date.now() > exp) {
    return { ok: false, reason: "Payment session window expired" };
  }

  const proof = input.sessionProof;
  if (!proof?.proof || proof.circuit !== "prove_session_auth") {
    return { ok: false, reason: "Missing prove_session_auth for confirm-tap" };
  }
  const pi = proof.publicInputs ?? {};
  if (pi.challenge !== challenge) {
    return { ok: false, reason: "Session proof not bound to payment intent" };
  }
  const rpHash = sha256(`rp:${relyingPartyId}`);
  if (pi.relying_party_id !== rpHash) {
    return { ok: false, reason: "Session proof relying party mismatch" };
  }
  if (pi.kyc_registry_root !== store.kycRoot) {
    return { ok: false, reason: "KYC registry root mismatch" };
  }
  if (pi.time_window !== sha256(input.timeWindow)) {
    return { ok: false, reason: "Session proof time window mismatch" };
  }

  const leaf = store.kycLeaves.find((l) => l.leaf === input.credentialCommitment);
  if (!leaf || leaf.revoked || store.revokedNullifiers.includes(leaf.nullifier)) {
    return { ok: false, reason: "Credential revoked" };
  }

  store.spentChallenges.push(nonce);
  store.events.push({
    id: randomNonce(8),
    type: "kyc_commit",
    timestamp: Date.now(),
    delayedUntil: Date.now(),
    released: true,
    meta: {
      note: "CircledProof confirm-tap — payment intent bound; no OTP",
      nyxproof: true,
      mode: "payment",
    },
  });
  saveStore(store);
  return { ok: true, burned: true };
}

export function nyxproofDocument() {
  return {
    title: "CircledProof — A Midnight-Based Replacement for OTP",
    version: "1.0.0",
    oneLiner:
      "Device proves locally that it holds a valid KYC credential for this challenge, party, and window — nothing interceptable, replayable, or phishable.",
    circuit: "prove_session_auth",
    reuses: ["prove_kyc_membership", "kyc_registry_root", "revoked-nullifier set"],
    properties: {
      noTransmittableSecret: true,
      simSwapImmune: true,
      ss7Immune: true,
      phishingRelayImmune: true,
      marginalCost: 0,
      optionalUnlinkability: true,
    },
    vsWebAuthn:
      "Headline differentiator is infrastructure reuse (same KYC tree) + optional unlinkability across relying parties — not anti-phishing alone (WebAuthn already provides that).",
    regulatoryNote:
      "Validate as 'something you have' against jurisdiction-specific 2FA language before treating as OTP-equivalent.",
  };
}
