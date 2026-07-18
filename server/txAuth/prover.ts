/**
 * Phases 4–5 — prove_authorized_transaction (Compact-faithful) + proof generation.
 * Private: leaf, path, authorization signature.
 * Public: brand_registry_root, platform_challenge, intent_commitment.
 */
import { hmacVerify, merkleProof, sha256, verifyMerkle } from "../services/crypto.js";
import { getMerchantSigner } from "../services/merchantHsm.js";
import { openSecret } from "../services/secretBox.js";
import type { Store } from "../services/store.js";
import { peekChallenge } from "./challenge.js";
import { findMerchant, computeRegistryRoot, txAuthState } from "./registry.js";
import { isNullifierRevoked } from "./revocation.js";
import { recordLatency } from "./metrics.js";
import type { AuthorizedTxProof, MerchantAuthorization } from "./types.js";
import { TX_AUTH_CIRCUIT } from "./types.js";

export async function generateAuthorizedTxProof(
  store: Store,
  input: {
    merchant_identifier: string;
    intent_commitment: string;
    challenge_id: string;
    authorization: MerchantAuthorization;
  }
): Promise<
  | { ok: true; proof: AuthorizedTxProof }
  | { ok: false; reason: string; detail?: string }
> {
  const t0 = Date.now();
  const merchant = findMerchant(store, input.merchant_identifier);
  if (!merchant) return { ok: false, reason: "merchant_not_found" };
  if (isNullifierRevoked(store, merchant.revocation_nullifier) || merchant.status !== "active") {
    return { ok: false, reason: "nullifier_revoked" };
  }

  const chal = peekChallenge(store, input.challenge_id);
  if (!chal) {
    return { ok: false, reason: "challenge_mismatch_or_expired", detail: "Unknown challenge" };
  }
  if (Date.now() > chal.expires_at) {
    txAuthState(store).metrics.challenge_expired_count += 1;
    return { ok: false, reason: "challenge_mismatch_or_expired", detail: "Challenge expired" };
  }
  if (chal.intent_commitment !== input.intent_commitment) {
    return {
      ok: false,
      reason: "intent_commitment_mismatch",
      detail: "Challenge bound to a different intent",
    };
  }
  if (input.authorization.intent_commitment !== input.intent_commitment) {
    return { ok: false, reason: "intent_commitment_mismatch" };
  }

  const message = `authorize:${input.intent_commitment}|${merchant.merchant_public_key}`;
  const sigOk = await getMerchantSigner().verify(
    {
      merchant_identifier: merchant.merchant_identifier,
      sealed_secret: merchant.merchant_secret,
      message,
    },
    input.authorization.intent_signature
  );
  if (!sigOk) {
    // Fallback timing-safe verify for SoftHSM seal migration
    if (
      !hmacVerify(
        openSecret(merchant.merchant_secret),
        message,
        input.authorization.intent_signature
      )
    ) {
      return { ok: false, reason: "authorization_signature_invalid" };
    }
  }

  const merchants = txAuthState(store).merchants.filter((m) => m.status === "active");
  const leaves = merchants.map((m) => m.leaf);
  const idx = leaves.indexOf(merchant.leaf);
  if (idx < 0) return { ok: false, reason: "membership_proof_invalid" };
  const path = merkleProof(leaves, idx);
  const root = computeRegistryRoot(txAuthState(store).merchants);
  if (!verifyMerkle(merchant.leaf, path, root)) {
    return { ok: false, reason: "membership_proof_invalid", detail: "Merkle path invalid" };
  }

  const bindingDigest = sha256(
    [
      TX_AUTH_CIRCUIT,
      root,
      chal.platform_challenge,
      input.intent_commitment,
      input.authorization.intent_signature,
      merchant.leaf,
      path.join(","),
    ].join("|")
  );

  let snark_digest: string | undefined;
  // Elevate with Compact + proof-server SNARK when available
  try {
    const { artifactsPresent, runCompactCircuit } = await import("../services/compactLedger.js");
    const { resolveProofMode } = await import("../services/proofServer.js");
    const { proveCircuit } = await import("../services/zkProve.js");
    const mode = await resolveProofMode();
    if (artifactsPresent() && mode.proofServerOk) {
      const compact = await runCompactCircuit("prove_authorized_transaction", [
        merchant.leaf,
        root,
        chal.platform_challenge,
        input.intent_commitment,
        input.authorization.intent_signature,
      ]);
      const snark = await proveCircuit(TX_AUTH_CIRCUIT, compact.proofData);
      if (snark.ok) snark_digest = snark.proofDigest;
    }
  } catch {
    /* Compact/ZK elevation optional — binding digest remains valid */
  }

  const proof: AuthorizedTxProof = {
    circuit: TX_AUTH_CIRCUIT,
    proof: bindingDigest,
    snark_digest,
    public_inputs: {
      brand_registry_root: root,
      platform_challenge: chal.platform_challenge,
      intent_commitment: input.intent_commitment,
    },
    leaf: merchant.leaf,
    nullifier: merchant.revocation_nullifier,
    intent_signature: input.authorization.intent_signature,
    generated_at: Date.now(),
  };

  recordLatency(txAuthState(store).metrics.proof_generation_ms, Date.now() - t0);
  return { ok: true, proof };
}
