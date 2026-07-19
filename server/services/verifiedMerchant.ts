/**
 * verified-merchant-payment — agent-facing wrapper around a26z-Brand-style
 * brand registry membership + payment-address binding + challenge freshness
 * + nullifier revocation. Maps onto Circle crypto (Merkle + HMAC binding +
 * challenge burn), same patterns as prove_recipient_valid / CircleProof.
 */
import { hmacSign, hmacVerify, merkleRoot, randomNonce, sha256 } from "./crypto.js";
import { allowMerchantAutoProve } from "./merchantHsm.js";
import { openSecret, sealSecret } from "./secretBox.js";
import type { Store } from "./store.js";
import { saveStore } from "./store.js";

export const SKILL_NAME = "verified-merchant-payment";
export const SKILL_VERSION = "1.0";
export const SKILL_PROVIDER = "a26z-Brand";

export const PROVABLE_CLAIMS = [
  "official_merchant",
  "owns_payment_address",
  "not_revoked",
] as const;

export type ProvableClaim = (typeof PROVABLE_CLAIMS)[number];

export type FailureReason =
  | "merchant_not_found_in_registry"
  | "membership_proof_invalid"
  | "address_binding_invalid"
  | "nullifier_revoked"
  | "challenge_mismatch_or_expired"
  | "unsupported_claim_requested"
  | "missing_required_fields";

export type MerchantLeaf = {
  identifier: string;
  displayName: string;
  brandId: string;
  /** Sealed HMAC key material (enc:v1:…) — never returned in API */
  vendorSecret: string;
  vendorPubkey: string;
  paymentAddresses: string[];
  leaf: string;
  nullifier: string;
  revoked: boolean;
};

export type BrandRegistry = {
  brandId: string;
  brandName: string;
  root: string;
  merchantIdentifiers: string[];
};

export type MerchantChallenge = {
  id: string;
  nonce: string;
  agentSessionId: string;
  timeWindow: string;
  platformChallenge: string;
  paymentAddress: string;
  merchantIdentifier: string;
  issuedAt: number;
  expiresAt: number;
};

export type VerifyInput = {
  merchant_identifier: string;
  payment_address: string;
  network: string;
  amount?: number;
  required_claims?: string[];
  agent_session_id?: string;
  /** Optional: skip auto-prove and supply an external proof bundle */
  proof?: AuthorizedVendorProof;
};

export type AuthorizedVendorProof = {
  circuit: "prove_authorized_vendor";
  proof: string;
  publicInputs: {
    brand_registry_root: string;
    platform_challenge: string;
    payment_address: string;
  };
  /** Address ownership signature by vendor key over payment_address|challenge */
  address_ownership_sig: string;
  leaf: string;
  nullifier: string;
};

export type VerifySuccess = {
  verified: true;
  merchant: string;
  payment_address: string;
  claims_verified: ProvableClaim[];
  proof_challenge_id: string;
  verified_at: string;
  private_information_exposed: false;
  network: string;
  skill: { name: string; version: string; provider: string };
  checks: {
    membership: true;
    address_binding: true;
    not_revoked: true;
    challenge_fresh: true;
  };
};

export type VerifyFailure = {
  verified: false;
  reason: FailureReason;
  detail?: string;
  private_information_exposed: false;
  skill: { name: string; version: string; provider: string };
};

const CHALLENGE_MS = 5 * 60 * 1000;

function brandState(store: Store) {
  if (!store.brandRegistries) store.brandRegistries = {};
  if (!store.merchantLeaves) store.merchantLeaves = [];
  if (!store.revokedVendorNullifiers) store.revokedVendorNullifiers = [];
  if (!store.merchantChallenges) store.merchantChallenges = {};
  if (!store.spentMerchantChallenges) store.spentMerchantChallenges = [];
}

function recomputBrandRoot(store: Store, brandId: string) {
  brandState(store);
  const leaves = store.merchantLeaves!
    .filter((m) => m.brandId === brandId && !m.revoked)
    .map((m) => m.leaf);
  const root = merkleRoot(leaves.length ? leaves : [sha256(`empty-brand:${brandId}`)]);
  const reg = store.brandRegistries![brandId];
  if (reg) {
    reg.root = root;
    reg.merchantIdentifiers = store.merchantLeaves!
      .filter((m) => m.brandId === brandId && !m.revoked)
      .map((m) => m.identifier);
  }
  return root;
}

function leafPreimage(input: {
  identifier: string;
  vendorPubkey: string;
  brandId: string;
}): string {
  return sha256(
    `a26z:vendor:${input.brandId}|${input.identifier}|${input.vendorPubkey}`
  );
}

/** Seed demo brand registries (Nike etc.) for judge / agent demos */
export function ensureDemoBrandRegistries(store: Store) {
  brandState(store);
  if (store.merchantLeaves!.length > 0) return;

  const demos: Array<{
    brandId: string;
    brandName: string;
    identifier: string;
    displayName: string;
    paymentAddresses: string[];
  }> = [
    {
      brandId: "nike",
      brandName: "Nike Inc.",
      identifier: "nike.com",
      displayName: "Nike Inc.",
      paymentAddresses: [
        "0x8a72f9c1d4e5b6a7080910111213141516171819",
        "midnight1nikeofficialpayaddrdemo0001",
      ],
    },
    {
      brandId: "acme",
      brandName: "Acme Commerce",
      identifier: "shop.acme.example",
      displayName: "Acme Commerce Ltd.",
      paymentAddresses: ["0xacme000000000000000000000000000000000001"],
    },
  ];

  for (const d of demos) {
    if (!store.brandRegistries![d.brandId]) {
      store.brandRegistries![d.brandId] = {
        brandId: d.brandId,
        brandName: d.brandName,
        root: sha256("empty"),
        merchantIdentifiers: [],
      };
    }
    const vendorSecretPlain = randomNonce(32);
    const vendorPubkey = sha256(`vendorpk:${d.brandId}:${d.identifier}`);
    const leaf = leafPreimage({
      identifier: d.identifier,
      vendorPubkey,
      brandId: d.brandId,
    });
    const nullifier = sha256(`vendor-nf:${leaf}`);
    store.merchantLeaves!.push({
      identifier: d.identifier.toLowerCase(),
      displayName: d.displayName,
      brandId: d.brandId,
      vendorSecret: sealSecret(vendorSecretPlain),
      vendorPubkey,
      paymentAddresses: d.paymentAddresses.map((a) => a.toLowerCase()),
      leaf,
      nullifier,
      revoked: false,
    });
    recomputBrandRoot(store, d.brandId);
  }
  saveStore(store);
}

export function listBrandRegistries(store: Store) {
  ensureDemoBrandRegistries(store);
  brandState(store);
  return Object.values(store.brandRegistries!).map((r) => ({
    brandId: r.brandId,
    brandName: r.brandName,
    brand_registry_root: r.root,
    merchants: r.merchantIdentifiers,
    revoked_vendor_nullifier_count: store.revokedVendorNullifiers!.length,
  }));
}

export function resolveMerchant(
  store: Store,
  merchantIdentifier: string,
  opts?: { includeRevoked?: boolean }
) {
  ensureDemoBrandRegistries(store);
  brandState(store);
  const id = merchantIdentifier.trim().toLowerCase();
  const leaf = store.merchantLeaves!.find(
    (m) => m.identifier === id && (opts?.includeRevoked || !m.revoked)
  );
  if (!leaf) return null;
  const brand = store.brandRegistries![leaf.brandId];
  if (!brand) return null;
  return { leaf, brand };
}

export function issueMerchantChallenge(
  store: Store,
  input: {
    merchant_identifier: string;
    payment_address: string;
    agent_session_id?: string;
  }
):
  | { ok: true; challenge: MerchantChallenge; brand_registry_root: string }
  | { ok: false; reason: FailureReason; detail?: string } {
  const resolved = resolveMerchant(store, input.merchant_identifier);
  if (!resolved) {
    return { ok: false, reason: "merchant_not_found_in_registry" };
  }

  const issuedAt = Date.now();
  const expiresAt = issuedAt + CHALLENGE_MS;
  const timeWindow = `${issuedAt}:${expiresAt}`;
  const nonce = randomNonce(16);
  const agentSessionId = input.agent_session_id || randomNonce(12);
  const paymentAddress = input.payment_address.trim().toLowerCase();
  const platformChallenge = sha256(
    `a26z:mchal:${nonce}|${agentSessionId}|${timeWindow}|${paymentAddress}`
  );
  const id = `chal_${nonce.slice(0, 12)}`;

  const challenge: MerchantChallenge = {
    id,
    nonce,
    agentSessionId,
    timeWindow,
    platformChallenge,
    paymentAddress,
    merchantIdentifier: resolved.leaf.identifier,
    issuedAt,
    expiresAt,
  };

  brandState(store);
  store.merchantChallenges![id] = challenge;
  saveStore(store);

  return {
    ok: true,
    challenge,
    brand_registry_root: resolved.brand.root,
  };
}

/** Demo merchant prover — produces prove_authorized_vendor bound to challenge + address */
export function proveAuthorizedVendor(
  store: Store,
  input: {
    merchant_identifier: string;
    payment_address: string;
    platform_challenge: string;
    proof_challenge_id: string;
  }
):
  | { ok: true; proof: AuthorizedVendorProof }
  | { ok: false; reason: FailureReason; detail?: string } {
  const resolved = resolveMerchant(store, input.merchant_identifier);
  if (!resolved) return { ok: false, reason: "merchant_not_found_in_registry" };

  brandState(store);
  const chal = store.merchantChallenges![input.proof_challenge_id];
  if (!chal || Date.now() > chal.expiresAt) {
    return { ok: false, reason: "challenge_mismatch_or_expired", detail: "Unknown or expired challenge" };
  }
  if (chal.platformChallenge !== input.platform_challenge) {
    return { ok: false, reason: "challenge_mismatch_or_expired" };
  }
  if (chal.paymentAddress !== input.payment_address.trim().toLowerCase()) {
    return { ok: false, reason: "address_binding_invalid", detail: "Challenge bound to a different address" };
  }
  if (store.revokedVendorNullifiers!.includes(resolved.leaf.nullifier) || resolved.leaf.revoked) {
    return { ok: false, reason: "nullifier_revoked" };
  }

  const paymentAddress = input.payment_address.trim().toLowerCase();
  if (!resolved.leaf.paymentAddresses.includes(paymentAddress)) {
    return {
      ok: false,
      reason: "address_binding_invalid",
      detail: "Merchant credential is not authorized for this payment_address",
    };
  }

  const msg = `${paymentAddress}|${input.platform_challenge}`;
  const address_ownership_sig = hmacSign(openSecret(resolved.leaf.vendorSecret), msg);
  const proofDigest = sha256(
    `prove_authorized_vendor:${resolved.brand.root}|${input.platform_challenge}|${paymentAddress}|${address_ownership_sig}`
  );

  return {
    ok: true,
    proof: {
      circuit: "prove_authorized_vendor",
      proof: proofDigest,
      publicInputs: {
        brand_registry_root: resolved.brand.root,
        platform_challenge: input.platform_challenge,
        payment_address: paymentAddress,
      },
      address_ownership_sig,
      leaf: resolved.leaf.leaf,
      nullifier: resolved.leaf.nullifier,
    },
  };
}

function validateClaims(required: string[]):
  | { ok: true; claims: ProvableClaim[] }
  | { ok: false; reason: FailureReason; detail: string } {
  const claims = (required.length ? required : ["official_merchant", "owns_payment_address"]) as string[];
  for (const c of claims) {
    if (!PROVABLE_CLAIMS.includes(c as ProvableClaim)) {
      return {
        ok: false,
        reason: "unsupported_claim_requested",
        detail: `Claim "${c}" is outside the provable set [${PROVABLE_CLAIMS.join(", ")}]`,
      };
    }
  }
  // not_revoked always implied
  const set = new Set<ProvableClaim>([...(claims as ProvableClaim[]), "not_revoked"]);
  return { ok: true, claims: [...set] };
}

export function verifyMerchantPayment(
  store: Store,
  input: VerifyInput
): VerifySuccess | VerifyFailure {
  const skill = {
    name: SKILL_NAME,
    version: SKILL_VERSION,
    provider: SKILL_PROVIDER,
  };

  if (!input.merchant_identifier || !input.payment_address || !input.network) {
    return {
      verified: false,
      reason: "missing_required_fields",
      detail: "merchant_identifier, payment_address, and network are required",
      private_information_exposed: false,
      skill,
    };
  }

  const claimsCheck = validateClaims(input.required_claims ?? []);
  if (!claimsCheck.ok) {
    return {
      verified: false,
      reason: claimsCheck.reason,
      detail: claimsCheck.detail,
      private_information_exposed: false,
      skill,
    };
  }

  const resolved = resolveMerchant(store, input.merchant_identifier, { includeRevoked: true });
  if (!resolved) {
    return {
      verified: false,
      reason: "merchant_not_found_in_registry",
      detail: `${input.merchant_identifier} has no known brand verification registry`,
      private_information_exposed: false,
      skill,
    };
  }

  brandState(store);
  if (resolved.leaf.revoked || store.revokedVendorNullifiers!.includes(resolved.leaf.nullifier)) {
    return {
      verified: false,
      reason: "nullifier_revoked",
      private_information_exposed: false,
      skill,
    };
  }

  const paymentAddress = input.payment_address.trim().toLowerCase();

  // Fresh challenge every verify call (agent must not cache)
  const issued = issueMerchantChallenge(store, {
    merchant_identifier: input.merchant_identifier,
    payment_address: paymentAddress,
    agent_session_id: input.agent_session_id,
  });
  if (!issued.ok) {
    return {
      verified: false,
      reason: issued.reason,
      detail: issued.detail,
      private_information_exposed: false,
      skill,
    };
  }

  let proof = input.proof;
  if (!proof) {
    if (!allowMerchantAutoProve()) {
      return {
        verified: false,
        reason: "membership_proof_invalid",
        detail:
          "Enterprise mode: supply merchant proof from HSM (server auto-prove disabled)",
        private_information_exposed: false,
        skill,
      };
    }
    const proved = proveAuthorizedVendor(store, {
      merchant_identifier: input.merchant_identifier,
      payment_address: paymentAddress,
      platform_challenge: issued.challenge.platformChallenge,
      proof_challenge_id: issued.challenge.id,
    });
    if (!proved.ok) {
      return {
        verified: false,
        reason: proved.reason,
        detail: proved.detail,
        private_information_exposed: false,
        skill,
      };
    }
    proof = proved.proof;
  }

  // §3.3 freshness
  const chal = store.merchantChallenges![issued.challenge.id];
  if (!chal || Date.now() > chal.expiresAt) {
    return {
      verified: false,
      reason: "challenge_mismatch_or_expired",
      private_information_exposed: false,
      skill,
    };
  }
  if (store.spentMerchantChallenges!.includes(chal.id)) {
    return {
      verified: false,
      reason: "challenge_mismatch_or_expired",
      detail: "Challenge already consumed — request a fresh proof",
      private_information_exposed: false,
      skill,
    };
  }
  if (
    proof.publicInputs.platform_challenge !== chal.platformChallenge ||
    proof.publicInputs.payment_address !== paymentAddress
  ) {
    return {
      verified: false,
      reason: "challenge_mismatch_or_expired",
      detail: "Proof not bound to this platform_challenge / payment_address",
      private_information_exposed: false,
      skill,
    };
  }

  // §3.4 / §4 revocation — always on
  if (
    store.revokedVendorNullifiers!.includes(proof.nullifier) ||
    resolved.leaf.revoked ||
    store.revokedVendorNullifiers!.includes(resolved.leaf.nullifier)
  ) {
    return {
      verified: false,
      reason: "nullifier_revoked",
      private_information_exposed: false,
      skill,
    };
  }

  // §3.2 membership
  if (
    proof.leaf !== resolved.leaf.leaf ||
    proof.publicInputs.brand_registry_root !== resolved.brand.root
  ) {
    return {
      verified: false,
      reason: "membership_proof_invalid",
      private_information_exposed: false,
      skill,
    };
  }

  // §3.2 address ownership binding
  const msg = `${paymentAddress}|${chal.platformChallenge}`;
  if (!hmacVerify(openSecret(resolved.leaf.vendorSecret), msg, proof.address_ownership_sig)) {
    return {
      verified: false,
      reason: "address_binding_invalid",
      detail: "Credential is real but not tied to this destination address",
      private_information_exposed: false,
      skill,
    };
  }
  if (!resolved.leaf.paymentAddresses.includes(paymentAddress)) {
    return {
      verified: false,
      reason: "address_binding_invalid",
      private_information_exposed: false,
      skill,
    };
  }

  // Burn challenge — single-use, no static badge
  store.spentMerchantChallenges!.push(chal.id);
  delete store.merchantChallenges![chal.id];
  saveStore(store);

  return {
    verified: true,
    merchant: resolved.leaf.displayName,
    payment_address: paymentAddress,
    claims_verified: claimsCheck.claims,
    proof_challenge_id: chal.id,
    verified_at: new Date().toISOString(),
    private_information_exposed: false,
    network: input.network,
    skill,
    checks: {
      membership: true,
      address_binding: true,
      not_revoked: true,
      challenge_fresh: true,
    },
  };
}

export function revokeMerchant(
  store: Store,
  merchantIdentifier: string,
  reasonCode = "AUTHORIZATION_ENDED"
): { ok: true; nullifier: string; reasonCode: string } | { ok: false; reason: FailureReason } {
  const resolved = resolveMerchant(store, merchantIdentifier);
  if (!resolved) return { ok: false, reason: "merchant_not_found_in_registry" };
  brandState(store);
  resolved.leaf.revoked = true;
  if (!store.revokedVendorNullifiers!.includes(resolved.leaf.nullifier)) {
    store.revokedVendorNullifiers!.push(resolved.leaf.nullifier);
  }
  recomputBrandRoot(store, resolved.leaf.brandId);
  saveStore(store);
  return { ok: true, nullifier: resolved.leaf.nullifier, reasonCode };
}

export function skillDocument() {
  return {
    name: SKILL_NAME,
    version: SKILL_VERSION,
    provider: SKILL_PROVIDER,
    circuit: "prove_authorized_vendor",
    provable_claims: PROVABLE_CLAIMS,
    failure_reasons: [
      "merchant_not_found_in_registry",
      "membership_proof_invalid",
      "address_binding_invalid",
      "nullifier_revoked",
      "challenge_mismatch_or_expired",
      "unsupported_claim_requested",
    ],
    endpoints: {
      verify: "POST /api/skills/verified-merchant-payment",
      registries: "GET /api/skills/verified-merchant-payment/registries",
      challenge: "POST /api/skills/verified-merchant-payment/challenge",
      revoke: "POST /api/skills/verified-merchant-payment/revoke",
    },
    privacy:
      "Reveals only that this payment_address is bound to a currently-authorized, non-revoked registry entry for this challenge. No docs, tax IDs, keys, or other vendors exposed.",
  };
}
