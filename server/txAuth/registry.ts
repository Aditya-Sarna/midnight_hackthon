/**
 * Phase 1.2 — Merchant registry (enrollment, Merkle root, versioning).
 */
import { merkleRoot, randomNonce, sha256 } from "../services/crypto.js";
import { sealSecret } from "../services/secretBox.js";
import type { Store } from "../services/store.js";
import { saveStore } from "../services/store.js";
import type { MerchantIdentity, RegistrySnapshot } from "./types.js";
import { TX_AUTH_CIRCUIT, TX_AUTH_VERSION } from "./types.js";

export type TxAuthState = {
  merchants: MerchantIdentity[];
  revoked_nullifiers: string[];
  registry_version: number;
  challenges: Record<string, import("./types.js").PlatformChallenge>;
  spent_challenges: string[];
  metrics: import("./metrics.js").TxAuthMetrics;
};

export function txAuthState(store: Store): TxAuthState {
  if (!store.txAuth) {
    store.txAuth = {
      merchants: [],
      revoked_nullifiers: [],
      registry_version: 0,
      challenges: {},
      spent_challenges: [],
      metrics: {
        proof_generation_ms: [],
        verification_ms: [],
        success_count: 0,
        failure_count: 0,
        failures_by_reason: {},
        challenge_expired_count: 0,
        last_sync_at: 0,
        registry_version: 0,
      },
    };
  }
  return store.txAuth;
}

function leafFor(merchant_identifier: string, merchant_public_key: string): string {
  return sha256(`a26z:merchant:${merchant_identifier}|${merchant_public_key}`);
}

export function computeRegistryRoot(merchants: MerchantIdentity[]): string {
  const active = merchants.filter((m) => m.status === "active").map((m) => m.leaf);
  return merkleRoot(active.length ? active : [sha256("a26z:empty-registry")]);
}

export function snapshot(store: Store): RegistrySnapshot {
  const s = txAuthState(store);
  return {
    brand_registry_root: computeRegistryRoot(s.merchants),
    registry_version: s.registry_version,
    merchant_count: s.merchants.filter((m) => m.status === "active").length,
    updated_at: Date.now(),
    metadata: {
      name: "a26z-Brand Transaction Authorization Registry",
      provider: "a26z-Brand",
      circuit: TX_AUTH_CIRCUIT,
    },
  };
}

export function enrollMerchant(
  store: Store,
  input: {
    merchant_identifier: string;
    display_name: string;
    brand_id?: string;
  }
): MerchantIdentity {
  const s = txAuthState(store);
  const id = input.merchant_identifier.trim().toLowerCase();
  const existing = s.merchants.find((m) => m.merchant_identifier === id);
  if (existing && existing.status === "active") return existing;

  const merchant_secret_plain = randomNonce(32);
  const merchant_public_key = sha256(`a26z:mpk:${id}:${merchant_secret_plain}`);
  const leaf = leafFor(id, merchant_public_key);
  const revocation_nullifier = sha256(`a26z:m-nf:${leaf}`);

  const merchant: MerchantIdentity = {
    merchant_identifier: id,
    merchant_public_key,
    merchant_secret: sealSecret(merchant_secret_plain),
    credential_metadata: {
      display_name: input.display_name,
      brand_id: input.brand_id || id.replace(/\./g, "_"),
      enrolled_at: Date.now(),
      credential_version: 1,
    },
    revocation_nullifier,
    status: "active",
    leaf,
  };

  s.merchants = s.merchants.filter((m) => m.merchant_identifier !== id);
  s.merchants.push(merchant);
  s.registry_version += 1;
  s.metrics.registry_version = s.registry_version;
  saveStore(store);
  return merchant;
}

export function findMerchant(
  store: Store,
  merchant_identifier: string,
  opts?: { includeRevoked?: boolean }
): MerchantIdentity | null {
  const s = txAuthState(store);
  const id = merchant_identifier.trim().toLowerCase();
  const m = s.merchants.find((x) => x.merchant_identifier === id);
  if (!m) return null;
  if (!opts?.includeRevoked && m.status !== "active") return null;
  return m;
}

export function publicMerchantView(m: MerchantIdentity) {
  return {
    merchant_identifier: m.merchant_identifier,
    merchant_public_key: m.merchant_public_key,
    credential_metadata: m.credential_metadata,
    revocation_nullifier: m.revocation_nullifier,
    status: m.status,
    leaf: m.leaf,
  };
}

export function ensureDemoMerchants(store: Store) {
  const s = txAuthState(store);
  if (s.merchants.length > 0) return;
  const demos = [
    { merchant_identifier: "nike.com", display_name: "Nike Inc.", brand_id: "nike" },
    { merchant_identifier: "apple.com", display_name: "Apple Inc.", brand_id: "apple" },
    { merchant_identifier: "shop.acme.example", display_name: "Acme Commerce", brand_id: "acme" },
  ];
  for (const d of demos) enrollMerchant(store, d);
}

export function registryDocument(store: Store) {
  return {
    ...snapshot(store),
    skill_version: TX_AUTH_VERSION,
    revoked_nullifier_count: txAuthState(store).revoked_nullifiers.length,
  };
}
