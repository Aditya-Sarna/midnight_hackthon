const BASE = "/api";

export async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (data as { error?: string; reason?: string }).error ||
        (data as { reason?: string }).reason ||
        `Request failed (${res.status})`
    );
  }
  return data as T;
}

export type PublicUser = {
  id: string;
  displayName: string;
  deviceId: string;
  pubkey: string;
  credentialCommitment: string;
  balanceCommitment: string;
  policyCommitment: string;
  policyActive: string[];
  policyParams: null;
  contacts: {
    label: string;
    displayContext: string;
    addressCommitment: string;
    hasEnrollmentSig: boolean;
  }[];
  createdAt: number;
  class0DeviceOnly?: true;
};

export type PendingIntent = {
  amount: number;
  recipientLabel: string;
  category: string;
  intentCommitment: string;
  intentNonce: string;
  recipientAddress: string;
  recipientPubkey: string;
  requiresSecondaryConfirm: boolean;
  policyWitness: { templatesChecked: string[]; countersNext: Record<string, number> };
  recipientProof: { circuit: string; proof: string; publicInputs?: Record<string, string> };
  policyProof: { circuit: string; proof: string; publicInputs?: Record<string, string> };
  spendProof: { circuit: string; proof: string; publicInputs?: Record<string, string> };
  oldBalanceCommitment: string;
  newBalanceCommitment: string;
  newBalanceNonce: string;
  newPolicyCommitment: string;
  spendNullifier: string;
};

export const api = {
  health: () =>
    req<{
      ok: boolean;
      version: string;
      class0?: string;
      proofMode?: {
        mode: string;
        proofServerOk: boolean;
        artifactsOk?: boolean;
        detail?: string;
        circuits?: string[];
        proverKeysLoaded?: string[];
      };
      compactLedger?: {
        ready: boolean;
        transferCount?: string;
        spentNullifierCount?: string;
        spentChallengeCount?: string;
      };
      onchain?: {
        contractAddress: string | null;
        readyForSubmit: boolean;
        walletSeedConfigured: boolean;
      };
      compliance?: { services: number; gapsOpen: number };
    }>("/health"),
  midnight: () =>
    req<{
      proofMode?: {
        mode: string;
        detail?: string;
        artifactsOk?: boolean;
        proofServerOk?: boolean;
        proverKeysLoaded?: string[];
      };
      compactArtifacts?: { ok: boolean; detail: string };
      compactLedger?: Record<string, unknown>;
      onchain?: Record<string, unknown>;
    }>("/midnight"),
  ledger: () =>
    req<{
      kycRegistryRoot: string;
      spentNullifierCount: number;
      revokedNullifierCount: number;
      pendingInRelay: number;
      events: {
        id: string;
        type: string;
        timestamp: number;
        nullifier?: string;
        newBalanceCommitment?: string;
        note?: string;
      }[];
    }>("/ledger"),
  directory: () =>
    req<{
      users: {
        id: string;
        displayName: string;
        pubkeyHint: string;
        publicKeyJwk: JsonWebKey;
        credentialCommitment: string;
      }[];
    }>("/directory"),
  getUser: (id: string) =>
    req<{ user: PublicUser; vault: unknown; kycRoot: string }>(`/users/${id}`),
  compliance: () =>
    req<{
      title: string;
      version: string;
      designInvariant: string;
      serviceInventory: { id: string; name: string }[];
      gapsToDisclose: { id: string; title: string; status: string; detail: string }[];
      productionGrade?: Record<string, string>;
    }>("/compliance"),
  vault: (id: string) =>
    req<{ threshold: number; holders: { id: string; label: string }[] }>(`/users/${id}/vault`),
  recover: (id: string, holderIds: string[]) =>
    req<{ ciphertext: string; shares: string[]; threshold: number; note?: string }>(
      `/users/${id}/vault/recover`,
      { method: "POST", body: JSON.stringify({ holderIds }) }
    ),
  lookupBrand: (recipient: string) =>
    req<BrandLookup>("/brands/lookup", {
      method: "POST",
      body: JSON.stringify({ recipient }),
    }),
  brandStats: () =>
    req<{ total: number; registeredCount: number; unregisteredCount: number }>("/brands/stats"),
};

export type BrandLookup = {
  found: boolean;
  isBrand: boolean;
  registered: boolean;
  status: "verified" | "unverified_brand" | "not_a_brand";
  message: string;
  logoUrl: string | null;
  merchant_identifier: string | null;
  payment_address: string | null;
  brand: {
    id: string;
    name: string;
    domain: string;
    category: string;
    registered: boolean;
  } | null;
};

export function deviceId(): string {
  const key = "circled_device_id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = `ios-${crypto.randomUUID().slice(0, 8)}`;
    localStorage.setItem(key, id);
  }
  return id;
}

export function saveSession(userId: string) {
  localStorage.setItem("circled_user_id", userId);
}

export function loadSession(): string | null {
  return localStorage.getItem("circled_user_id");
}

export function clearSession() {
  localStorage.removeItem("circled_user_id");
}
