/**
 * Phase 6 — Verification engine.
 */
import { hmacVerify, merkleProof, sha256, verifyMerkle } from "../services/crypto.js";
import { openSecret } from "../services/secretBox.js";
import type { Store } from "../services/store.js";
import { consumeChallenge, peekChallenge } from "./challenge.js";
import { assertIntentMatchesCommitment } from "./intent.js";
import { recordLatency } from "./metrics.js";
import { computeRegistryRoot, findMerchant, txAuthState } from "./registry.js";
import { isNullifierRevoked } from "./revocation.js";
import type {
  AuthorizedTxProof,
  TransactionIntent,
  VerificationResult,
  VerifyFailureReason,
} from "./types.js";
import { TX_AUTH_CIRCUIT } from "./types.js";
import { saveStore } from "../services/store.js";

function fail(reason: VerifyFailureReason, detail?: string): VerificationResult {
  return { authorized: false, reason, detail, private_information_exposed: false };
}

export function verifyAuthorizedTransaction(
  store: Store,
  input: {
    intent: TransactionIntent;
    intent_commitment: string;
    challenge_id: string;
    proof: AuthorizedTxProof;
  }
): VerificationResult {
  const t0 = Date.now();
  const metrics = txAuthState(store).metrics;

  const finish = (result: VerificationResult): VerificationResult => {
    recordLatency(metrics.verification_ms, Date.now() - t0);
    if (result.authorized) {
      metrics.success_count += 1;
    } else {
      metrics.failure_count += 1;
      metrics.failures_by_reason[result.reason] =
        (metrics.failures_by_reason[result.reason] ?? 0) + 1;
    }
    saveStore(store);
    return result;
  };

  if (!input.intent || !input.intent_commitment || !input.challenge_id || !input.proof) {
    return finish(fail("missing_required_fields"));
  }
  if (input.proof.circuit !== TX_AUTH_CIRCUIT) {
    return finish(fail("proof_invalid", "Unexpected circuit"));
  }
  if (!assertIntentMatchesCommitment(input.intent, input.intent_commitment)) {
    return finish(fail("intent_commitment_mismatch", "Intent modified after commit"));
  }
  if (input.proof.public_inputs.intent_commitment !== input.intent_commitment) {
    return finish(fail("intent_commitment_mismatch", "Proof not bound to this intent"));
  }

  const merchant = findMerchant(store, input.intent.merchant_identifier, {
    includeRevoked: true,
  });
  if (!merchant) return finish(fail("merchant_not_found"));

  if (isNullifierRevoked(store, merchant.revocation_nullifier) || merchant.status === "revoked") {
    return finish(fail("nullifier_revoked"));
  }

  const root = computeRegistryRoot(txAuthState(store).merchants);
  if (input.proof.public_inputs.brand_registry_root !== root) {
    return finish(fail("registry_inconsistency", "Stale or forged registry root"));
  }
  if (input.proof.leaf !== merchant.leaf) {
    return finish(fail("membership_proof_invalid"));
  }
  const activeLeaves = txAuthState(store)
    .merchants.filter((m) => m.status === "active")
    .map((m) => m.leaf);
  const leafIdx = activeLeaves.indexOf(merchant.leaf);
  if (leafIdx < 0) return finish(fail("membership_proof_invalid"));
  const path = merkleProof(activeLeaves, leafIdx);
  if (!verifyMerkle(merchant.leaf, path, root)) {
    return finish(fail("membership_proof_invalid", "Merkle authentication path failed"));
  }

  const pending = peekChallenge(store, input.challenge_id);
  if (!pending) {
    return finish(fail("challenge_mismatch_or_expired", "Unknown or already used challenge"));
  }
  if (input.proof.public_inputs.platform_challenge !== pending.platform_challenge) {
    return finish(fail("challenge_mismatch_or_expired", "Proof challenge mismatch"));
  }
  if (Date.now() - input.proof.generated_at > 10 * 60 * 1000) {
    return finish(fail("expired_proof"));
  }

  const sigOk = hmacVerify(
    openSecret(merchant.merchant_secret),
    `authorize:${input.intent_commitment}|${merchant.merchant_public_key}`,
    input.proof.intent_signature
  );
  if (!sigOk) {
    return finish(fail("authorization_signature_invalid"));
  }

  const expectedProof = sha256(
    [
      TX_AUTH_CIRCUIT,
      root,
      pending.platform_challenge,
      input.intent_commitment,
      input.proof.intent_signature,
      merchant.leaf,
      path.join(","),
    ].join("|")
  );
  if (expectedProof !== input.proof.proof) {
    return finish(fail("proof_invalid", "Proof digest mismatch"));
  }

  const consumed = consumeChallenge(store, input.challenge_id);
  if (!consumed.ok) {
    return finish(fail(consumed.reason, consumed.detail));
  }

  return finish({
    authorized: true,
    merchant_identifier: merchant.merchant_identifier,
    intent_commitment: input.intent_commitment,
    proof_challenge_id: input.challenge_id,
    verified_at: new Date().toISOString(),
    registry_version: txAuthState(store).registry_version,
    settlement_rail: input.intent.settlement_rail,
    private_information_exposed: false,
    checks: {
      membership: true,
      authorization_signature: true,
      not_revoked: true,
      challenge_fresh: true,
      intent_bound: true,
    },
  });
}
