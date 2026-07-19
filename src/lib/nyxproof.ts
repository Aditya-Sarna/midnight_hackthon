/**
 * Circle session auth — client-side prove_session_auth (Class 0 witnesses stay on device).
 */
import { makeProof, sha256, signMessage } from "./crypto";
import type { DeviceVaultState } from "./deviceVault";

export type CircleProofChallenge = {
  nonce: string;
  relyingPartyId: string;
  timeWindow: string;
  challenge: string;
  kycRegistryRoot: string;
  issuedAt: number;
  expiresAt: number;
  unlinkable: boolean;
};

/**
 * Produce prove_session_auth bound to (challenge, relying_party_id, time_window).
 * User action is confirm-tap / device unlock only — no code to type or transmit.
 */
export async function proveSessionAuth(
  vault: DeviceVaultState,
  challenge: CircleProofChallenge
) {
  if (Date.now() > challenge.expiresAt) {
    throw new Error("Challenge expired before proof generation");
  }

  const rpId = await sha256(`rp:${challenge.relyingPartyId}`);
  const timeWindowDigest = await sha256(challenge.timeWindow);

  // Device key binding: ECDSA signature over the public challenge (Class 0 key never leaves device)
  const deviceBinding = await signMessage(
    vault.keypair.privateKeyJwk,
    `nyxproof:bind:${challenge.challenge}|${rpId}|${vault.credentialCommitment}`,
    vault.userId,
    vault.keypair.pubkey
  );

  const publicInputs = {
    challenge: challenge.challenge,
    relying_party_id: rpId,
    time_window: timeWindowDigest,
    kyc_registry_root: challenge.kycRegistryRoot,
    membership: "1",
    contract: "contracts/nyxpay.compact#prove_session_auth",
  };

  const proof = await makeProof(
    "prove_session_auth",
    publicInputs,
    await sha256(
      `${vault.credentialCommitment}|${vault.kycNullifier}|${deviceBinding}|${challenge.nonce}`
    )
  );

  return {
    ...proof,
    circuit: "prove_session_auth" as const,
    /** Sent only when unlinkable=false; omitted for privacy-preserving RP mode */
    credentialCommitment: challenge.unlinkable ? undefined : vault.credentialCommitment,
    deviceBindingHint: `${deviceBinding.slice(0, 12)}…`,
  };
}

/** Payment confirm-tap: challenge context = intent commitment */
export async function provePaymentSessionAuth(
  vault: DeviceVaultState,
  intentCommitment: string,
  kycRegistryRoot: string
) {
  const issuedAt = Date.now();
  const expiresAt = issuedAt + 5 * 60 * 1000;
  const timeWindow = `${issuedAt}:${expiresAt}`;
  const relyingPartyId = `circled:payment:${intentCommitment}`;
  const nonce = intentCommitment.slice(0, 48);
  const challenge = await sha256(
    `nyxproof:challenge:${nonce}|${relyingPartyId}|${timeWindow}`
  );

  const sessionProof = await proveSessionAuth(vault, {
    nonce,
    relyingPartyId,
    timeWindow,
    challenge,
    kycRegistryRoot,
    issuedAt,
    expiresAt,
    unlinkable: false,
  });

  return { sessionProof, timeWindow, challenge, relyingPartyId };
}
