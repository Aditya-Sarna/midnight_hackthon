/**
 * Device Class 0 vault — privateKey, balance, contacts, policy never leave the device.
 * Encrypted-at-rest with a non-extractable AES-GCM wrap key (IndexedDB).
 */
import {
  aesDecrypt,
  commit,
  generateKeypairWithRecovery,
  randomNonce,
  type DeviceKeypair,
} from "./crypto";
import { compactBalanceCommit, randomOpeningHex } from "./compactCommit";
import type { PolicyState } from "./policy";
import {
  clearVaultCrypto,
  decryptWithWrapKey,
  encryptWithWrapKey,
  migrateLegacyVaultCipher,
} from "./vaultCrypto";
import {
  clearDeviceKeys,
  keyRefForPubkey,
  migrateJwksToKeyStore,
} from "./keyStore";

const VAULT_PREFIX = "circled_vault_v3_";

/** Strip private JWKs before disk — privates live in non-extractable IDB */
function forPersistence(state: DeviceVaultState): DeviceVaultState {
  const peers = state.demoPeerVaults;
  const keyRef = state.keypair.keyRef || keyRefForPubkey(state.keypair.pubkey);
  return {
    ...state,
    keypair: {
      publicKeyJwk: state.keypair.publicKeyJwk,
      pubkey: state.keypair.pubkey,
      encPublicKeyJwk: state.keypair.encPublicKeyJwk,
      sealed: true,
      keyRef,
    },
    demoPeerVaults: peers
      ? Object.fromEntries(
          Object.entries(peers).map(([id, v]) => [id, forPersistence(v)])
        )
      : undefined,
  };
}

async function sealLegacyKeys(state: DeviceVaultState): Promise<DeviceVaultState> {
  if (
    state.keypair.privateKeyJwk &&
    state.keypair.encPrivateKeyJwk
  ) {
    await migrateJwksToKeyStore(
      state.userId,
      state.keypair.privateKeyJwk,
      state.keypair.encPrivateKeyJwk,
      state.keypair.pubkey
    );
  }
  if (state.demoPeerVaults) {
    for (const peer of Object.values(state.demoPeerVaults)) {
      await sealLegacyKeys(peer);
    }
  }
  const keyRef = state.keypair.keyRef || keyRefForPubkey(state.keypair.pubkey);
  return {
    ...state,
    keypair: {
      publicKeyJwk: state.keypair.publicKeyJwk,
      pubkey: state.keypair.pubkey,
      encPublicKeyJwk: state.keypair.encPublicKeyJwk,
      sealed: true,
      keyRef,
    },
  };
}

export type ContactRecord = {
  label: string;
  address: string;
  recipientPubkey: string;
  recipientPublicKeyJwk: JsonWebKey;
  recipientEncPublicKeyJwk: JsonWebKey;
  displayContext: string;
  enrollmentSig: string;
  leaf: string;
  /** Optional note — Class 0 only */
  note?: string;
  addedAt?: number;
};

/** Class 0 payment history — never sent to server */
export type PaymentRecord = {
  id: string;
  amount: number;
  recipient: string;
  category: string;
  timestamp: number;
  direction: "out" | "in";
  /** Optional link for refunds / disputes */
  status?: "settled" | "disputed" | "refunded";
  disputeId?: string;
  parentPaymentId?: string;
};

export type DeviceVaultState = {
  version: 3;
  userId: string;
  displayName: string;
  keypair: DeviceKeypair;
  balance: number;
  balanceNonce: string;
  /** Compact persistentCommit opening (Class 0) — never sent except as witness hex */
  balanceOpening?: string;
  balanceCommitment: string;
  policy: PolicyState;
  contacts: ContactRecord[];
  credentialCommitment: string;
  kycNullifier: string;
  viewKey?: string;
  /** Past payments — device-only cycle history */
  paymentHistory?: PaymentRecord[];
  /** Circle Credit — locked collateral by loan id (Class 0 only) */
  lockedCollateral?: Record<string, number>;
  /** Demo-only peer vaults kept on-device for same-browser demos — never sent to server */
  demoPeerVaults?: Record<string, DeviceVaultState>;
};

export async function saveVault(state: DeviceVaultState, opts?: { activate?: boolean }): Promise<void> {
  // Strip demo peer vaults from production builds — never persist side wallets
  let toStore: DeviceVaultState =
    import.meta.env.PROD && state.demoPeerVaults
      ? { ...state, demoPeerVaults: undefined }
      : state;
  // Never write private JWKs to localStorage
  toStore = forPersistence(toStore);
  const ct = await encryptWithWrapKey(JSON.stringify(toStore));
  localStorage.setItem(`${VAULT_PREFIX}${state.userId}`, ct);
  if (opts?.activate !== false) {
    localStorage.setItem("circled_active_vault", state.userId);
  }
}

/** Drop / rewrite contacts polluted by ASR junk (e.g. "Deepak bhej dijiye") */
async function scrubAsrGarbageContacts(state: DeviceVaultState): Promise<DeviceVaultState> {
  const { sanitizePersonLabel, isAsrGarbageLabel } = await import("./voiceNormalize");
  let changed = false;
  const seen = new Set<string>();
  const contacts = [];
  for (const c of state.contacts ?? []) {
    const label = sanitizePersonLabel(c.label);
    if (!label || isAsrGarbageLabel(label) || isAsrGarbageLabel(c.label)) {
      changed = true;
      continue;
    }
    const key = label.toLowerCase();
    if (seen.has(key)) {
      changed = true;
      continue;
    }
    seen.add(key);
    if (label !== c.label) {
      changed = true;
      contacts.push({ ...c, label, displayContext: label });
    } else {
      contacts.push(c);
    }
  }
  if (!changed) return state;
  const next = { ...state, contacts };
  await saveVault(next, { activate: false });
  return next;
}

async function healOpeningsQuietly(state: DeviceVaultState): Promise<DeviceVaultState> {
  try {
    return await ensureCompactBalanceWitness(state);
  } catch {
    // Offline / server unavailable — credit/pay paths reseal when they run
    return state;
  }
}

export async function loadVault(userId?: string): Promise<DeviceVaultState | null> {
  const id = userId || localStorage.getItem("circled_active_vault");
  if (!id) return null;
  let ct = localStorage.getItem(`${VAULT_PREFIX}${id}`);
  if (!ct) return null;
  try {
    let state = JSON.parse(await decryptWithWrapKey(ct)) as DeviceVaultState;
    if (state.keypair?.privateKeyJwk || state.keypair?.encPrivateKeyJwk) {
      state = await sealLegacyKeys(state);
      await saveVault(state, { activate: false });
    }
    state = await scrubAsrGarbageContacts(state);
    return healOpeningsQuietly(state);
  } catch {
    const migrated = await migrateLegacyVaultCipher(ct, aesDecrypt);
    if (!migrated) return null;
    localStorage.setItem(`${VAULT_PREFIX}${id}`, migrated);
    try {
      let state = JSON.parse(await decryptWithWrapKey(migrated)) as DeviceVaultState;
      state = await sealLegacyKeys(state);
      await saveVault(state, { activate: false });
      state = await scrubAsrGarbageContacts(state);
      return healOpeningsQuietly(state);
    } catch {
      return null;
    }
  }
}

export function clearAllVaults(): void {
  const keys = Object.keys(localStorage).filter((k) => k.startsWith(VAULT_PREFIX));
  for (const k of keys) localStorage.removeItem(k);
  localStorage.removeItem("circled_active_vault");
  clearVaultCrypto();
  void clearDeviceKeys();
}

export async function createFreshVault(input: {
  userId: string;
  displayName: string;
  credentialCommitment: string;
  kycNullifier: string;
  initialBalance?: number;
  policy?: PolicyState;
}): Promise<DeviceVaultState> {
  const { vault } = await createFreshVaultWithRecovery(input);
  return vault;
}

/** Product path — returns one-shot JWKs for passphrase recovery kit */
export async function createFreshVaultWithRecovery(input: {
  userId: string;
  displayName: string;
  credentialCommitment: string;
  kycNullifier: string;
  initialBalance?: number;
  policy?: PolicyState;
}): Promise<{
  vault: DeviceVaultState;
  recoveryJwks?: {
    privateKeyJwk: JsonWebKey;
    encPrivateKeyJwk: JsonWebKey;
  };
}> {
  const generated = await generateKeypairWithRecovery(input.userId);
  /** Demo / judge wallets start funded — product path passes 0 explicitly */
  const balance = input.initialBalance ?? 100_000;
  const balanceNonce = randomNonce();
  const balanceOpening = randomOpeningHex();
  const balanceCommitment = await compactBalanceCommit(balance, balanceOpening);
  const policyNonce = randomNonce();
  const policy: PolicyState = input.policy ?? {
    active: ["T1", "T5"],
    params: {
      T1: { categoryId: "food", period: "month", cap: 500_000 },
      T5: { cap: 50_000_000 },
    },
    periodCounters: {},
    nonce: policyNonce,
    commitment: await commit(
      JSON.stringify({ active: ["T1", "T5"], counters: {} }),
      policyNonce
    ),
  };

  const state: DeviceVaultState = {
    version: 3,
    userId: input.userId,
    displayName: input.displayName,
    keypair: generated.keypair,
    balance,
    balanceNonce,
    balanceOpening,
    balanceCommitment,
    policy,
    contacts: [],
    credentialCommitment: input.credentialCommitment,
    kycNullifier: input.kycNullifier,
  };
  await saveVault(state, { activate: false });
  return { vault: state, recoveryJwks: generated.recoveryJwks };
}

export async function applySpend(
  vault: DeviceVaultState,
  amount: number,
  countersNext: Record<string, number>,
  openings: {
    balanceNonce: string;
    balanceOpening?: string;
    balanceCommitment: string;
    policyNonce: string;
    policyCommitment: string;
  },
  meta?: { recipient: string; category: string }
): Promise<DeviceVaultState> {
  const balance = vault.balance - amount;
  if (balance < 0) throw new Error("Insufficient private balance");
  const policy = {
    ...vault.policy,
    periodCounters: countersNext,
    nonce: openings.policyNonce,
    commitment: openings.policyCommitment,
  };
  const history = [...(vault.paymentHistory ?? [])];
  if (meta) {
    history.unshift({
      id: randomNonce(8),
      amount,
      recipient: meta.recipient,
      category: meta.category || "general",
      timestamp: Date.now(),
      direction: "out",
    });
  }
  const next = {
    ...vault,
    balance,
    balanceNonce: openings.balanceNonce,
    balanceOpening: openings.balanceOpening ?? vault.balanceOpening,
    balanceCommitment: openings.balanceCommitment,
    policy,
    paymentHistory: history.slice(0, 80),
  };
  await saveVault(next);
  return next;
}

/** Update Class 0 spending budgets (policy caps) — stays on device */
export async function updateSpendingBudgets(
  vault: DeviceVaultState,
  budgets: { categoryCap?: number; totalCap?: number; categoryId?: string }
): Promise<DeviceVaultState> {
  const params = { ...vault.policy.params };
  if (budgets.categoryCap != null) {
    params.T1 = {
      categoryId: budgets.categoryId || params.T1?.categoryId || "food",
      period: params.T1?.period || "month",
      cap: Math.max(0, budgets.categoryCap),
    };
  }
  if (budgets.totalCap != null) {
    params.T5 = { cap: Math.max(0, budgets.totalCap) };
  }
  const nonce = randomNonce();
  const commitment = await commit(
    JSON.stringify({ active: vault.policy.active, counters: vault.policy.periodCounters, params }),
    nonce
  );
  const next: DeviceVaultState = {
    ...vault,
    policy: {
      ...vault.policy,
      params,
      nonce,
      commitment,
    },
  };
  await saveVault(next);
  return next;
}

export async function applyCredit(
  vault: DeviceVaultState,
  amount: number,
  openings?: {
    balanceOpening: string;
    balanceCommitment: string;
    balanceNonce?: string;
  },
  meta?: { recipient: string; category: string }
): Promise<DeviceVaultState> {
  const balance = vault.balance + amount;
  const balanceNonce = openings?.balanceNonce ?? randomNonce();
  const balanceOpening = openings?.balanceOpening ?? randomOpeningHex();
  const balanceCommitment =
    openings?.balanceCommitment ?? (await compactBalanceCommit(balance, balanceOpening));
  const history = [...(vault.paymentHistory ?? [])];
  if (meta) {
    history.unshift({
      id: randomNonce(8),
      amount,
      recipient: meta.recipient,
      category: meta.category || "general",
      timestamp: Date.now(),
      direction: "in",
    });
  }
  const next = {
    ...vault,
    balance,
    balanceNonce,
    balanceOpening,
    balanceCommitment,
    paymentHistory: history.slice(0, 80),
  };
  await saveVault(next, { activate: false });
  return next;
}

async function fetchServerBalanceCommitment(userId: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/users/${encodeURIComponent(userId)}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { user?: { balanceCommitment?: string } };
    const c = String(data.user?.balanceCommitment ?? "");
    return c || null;
  } catch {
    return null;
  }
}

async function resealBalanceCommitment(
  userId: string,
  oldBalanceCommitment: string,
  newBalanceCommitment: string
): Promise<void> {
  if (oldBalanceCommitment === newBalanceCommitment) return;
  const res = await fetch(`/api/users/${encodeURIComponent(userId)}/reseal-balance`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ oldBalanceCommitment, newBalanceCommitment }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) {
    throw new Error(
      data.reason || data.error || "Could not reseal balance commitment"
    );
  }
}

/**
 * Align Class 0 vault with the server's public balanceCommitment.
 * Device balance is the product-rail source of truth; server commitment is updated to match.
 * Always prefer the server value as `oldBalanceCommitment` so drift cannot block Add money.
 */
export async function alignBalanceCommitmentWithServer(
  vault: DeviceVaultState
): Promise<DeviceVaultState> {
  const serverCommitment = await fetchServerBalanceCommitment(vault.userId);
  if (!serverCommitment) {
    throw new Error("Could not reach account — check the API is running");
  }

  const opening = vault.balanceOpening?.trim() ?? "";
  if (/^[0-9a-fA-F]{64}$/.test(opening)) {
    const expected = await compactBalanceCommit(vault.balance, opening);
    if (expected === serverCommitment) {
      if (vault.balanceCommitment === serverCommitment) return vault;
      const fixed = { ...vault, balanceCommitment: serverCommitment };
      await saveVault(fixed);
      return fixed;
    }
    // Opening opens a commitment that isn't on the server yet — push it
    if (expected === vault.balanceCommitment || vault.balanceCommitment !== serverCommitment) {
      await resealBalanceCommitment(vault.userId, serverCommitment, expected);
      const next = { ...vault, balanceCommitment: expected };
      await saveVault(next);
      return next;
    }
  }

  // Remint opening for current device balance and reseal from server tip
  const newOpening = randomOpeningHex();
  const newCommitment = await compactBalanceCommit(vault.balance, newOpening);
  await resealBalanceCommitment(vault.userId, serverCommitment, newCommitment);
  const next: DeviceVaultState = {
    ...vault,
    balanceOpening: newOpening,
    balanceCommitment: newCommitment,
    balanceNonce: vault.balanceNonce || randomNonce(),
  };
  await saveVault(next);
  return next;
}

/**
 * Ensure Class 0 opening opens the public balance commitment under Compact
 * persistentCommit. Migrates legacy / desynced vaults before credit or spend.
 */
export async function ensureCompactBalanceWitness(
  vault: DeviceVaultState
): Promise<DeviceVaultState> {
  try {
    return await alignBalanceCommitmentWithServer(vault);
  } catch {
    // Offline fallback: keep local consistency only
    const opening = vault.balanceOpening?.trim() ?? "";
    if (/^[0-9a-fA-F]{64}$/.test(opening)) {
      const expected = await compactBalanceCommit(vault.balance, opening);
      if (expected === vault.balanceCommitment) return vault;
    }
    throw new Error("Could not reseal balance opening for Compact credit");
  }
}
