/**
 * Phase 3 — Merchant authorization via HSM-backed signer (no raw secret export).
 */
import { openSecret } from "../services/secretBox.js";
import { allowMerchantAutoProve, getMerchantSigner } from "../services/merchantHsm.js";
import type { Store } from "../services/store.js";
import { findMerchant } from "./registry.js";
import type { MerchantAuthorization, TransactionIntent } from "./types.js";
import { assertIntentMatchesCommitment } from "./intent.js";

export async function authorizeIntent(
  store: Store,
  input: {
    intent: TransactionIntent;
    intent_commitment: string;
    /** When provided (external HSM / merchant agent), skip server signing */
    intent_signature?: string;
  }
): Promise<
  | { ok: true; authorization: MerchantAuthorization }
  | { ok: false; reason: string; detail?: string }
> {
  const merchant = findMerchant(store, input.intent.merchant_identifier, {
    includeRevoked: true,
  });
  if (!merchant) {
    return { ok: false, reason: "merchant_not_found" };
  }
  if (merchant.status !== "active") {
    return { ok: false, reason: "nullifier_revoked", detail: "Merchant not active" };
  }
  if (!assertIntentMatchesCommitment(input.intent, input.intent_commitment)) {
    return {
      ok: false,
      reason: "intent_commitment_mismatch",
      detail: "Intent does not match commitment",
    };
  }

  if (input.intent.amount > 1_000_000) {
    return { ok: false, reason: "policy_rejected", detail: "Amount exceeds merchant policy" };
  }

  const message = `authorize:${input.intent_commitment}|${merchant.merchant_public_key}`;

  if (input.intent_signature) {
    const signer = getMerchantSigner();
    const ok = await signer.verify(
      {
        merchant_identifier: merchant.merchant_identifier,
        sealed_secret: merchant.merchant_secret,
        message,
      },
      input.intent_signature
    );
    if (!ok) {
      return { ok: false, reason: "authorization_signature_invalid" };
    }
    return {
      ok: true,
      authorization: {
        intent_signature: input.intent_signature,
        merchant_identifier: merchant.merchant_identifier,
        intent_commitment: input.intent_commitment,
        signed_at: Date.now(),
      },
    };
  }

  if (!allowMerchantAutoProve()) {
    return {
      ok: false,
      reason: "authorization_signature_invalid",
      detail:
        "Enterprise mode: supply intent_signature from merchant HSM (auto-prove disabled)",
    };
  }

  const signer = getMerchantSigner();
  const intent_signature = await signer.sign({
    merchant_identifier: merchant.merchant_identifier,
    sealed_secret: merchant.merchant_secret,
    message,
  });

  return {
    ok: true,
    authorization: {
      intent_signature,
      merchant_identifier: merchant.merchant_identifier,
      intent_commitment: input.intent_commitment,
      signed_at: Date.now(),
    },
  };
}

/** Sync helper for verifiers still using openSecret+hmac — prefer HSM verify */
export function merchantSecretForLegacyVerify(sealed: string): string {
  return openSecret(sealed);
}
