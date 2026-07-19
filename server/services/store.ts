import { existsSync, mkdirSync, readFileSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import type { Database as SqliteDatabase } from "better-sqlite3";
import { commit, merkleProof, merkleRoot, randomNonce, sha256, hmacSign } from "./crypto.js";
import { pubkeyThumbprint } from "./keys.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "../../data");
const STORE_PATH = process.env.NYXPAY_STORE_PATH || join(DATA_DIR, "circled-store.db");
const LEGACY_STORE_PATH = join(DATA_DIR, "circled-store.json");
export const STORE_SCHEMA_VERSION = 4;
/** Production SQLite via better-sqlite3 (not Node's experimental node:sqlite). */
export const STORE_ENGINE = "better-sqlite3" as const;

let db: SqliteDatabase | null = null;

function storeDb(): SqliteDatabase {
  if (db) return db;
  const storeDir = dirname(STORE_PATH);
  if (!existsSync(storeDir)) mkdirSync(storeDir, { recursive: true });
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  db = new Database(STORE_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS store_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      payload TEXT NOT NULL,
      schema_version INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);
  return db;
}

function readPersistedStore(): Store | null {
  const row = storeDb()
    .prepare("SELECT payload FROM store_state WHERE id = 1")
    .get() as { payload: string } | undefined;
  return row ? (JSON.parse(row.payload) as Store) : null;
}

function persistStore(store: Store) {
  const payload = JSON.stringify(store, null, 2);
  storeDb()
    .prepare(
      `INSERT INTO store_state (id, payload, schema_version, updated_at)
       VALUES (1, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         payload = excluded.payload,
         schema_version = excluded.schema_version,
         updated_at = excluded.updated_at`
    )
    .run(payload, store.schemaVersion, Date.now());
}

function migrateLegacyJsonStore(): Store | null {
  if (!existsSync(LEGACY_STORE_PATH)) return null;
  const raw = JSON.parse(readFileSync(LEGACY_STORE_PATH, "utf8")) as Store;
  persistStore(raw);
  renameSync(LEGACY_STORE_PATH, `${LEGACY_STORE_PATH}.migrated`);
  return raw;
}

export interface KycLeaf {
  identityHash: string;
  jurisdiction: string;
  sanctionsClear: boolean;
  accreditationFlag: boolean;
  issuerSig: string;
  leaf: string;
  nullifier: string;
  pubkey: string;
  revoked: boolean;
}

/** Public account — Class 0 fields NEVER stored server-side */
export interface PublicAccount {
  id: string;
  displayName: string;
  deviceId: string;
  pubkey: string;
  publicKeyJwk: JsonWebKey;
  credentialCommitment: string;
  balanceCommitment: string;
  policyCommitment: string;
  policyActive: string[];
  kycNullifier: string;
  createdAt: number;
  /** Production marker */
  class0DeviceOnly: true;
}

export interface EncryptedNote {
  id: string;
  recipientPubkey: string;
  ephemeralPublicKeyJwk: JsonWebKey;
  ciphertext: string;
  /** Commitment to note — no amount in clear */
  noteCommitment: string;
  createdAt: number;
  claimed: boolean;
  dataClass: 1;
}

export interface LedgerEvent {
  id: string;
  type: "valid_transfer" | "decoy" | "kyc_commit" | "policy_commit";
  nullifier?: string;
  newBalanceCommitment?: string;
  newPolicyCommitment?: string;
  timestamp: number;
  delayedUntil: number;
  released: boolean;
  meta?: Record<string, unknown>;
}

export interface RecoveryVaultMeta {
  userId: string;
  /** Ciphertext only — shares held by threshold parties / device, not usable alone */
  ciphertext: string;
  shareHolders: { id: string; label: string; share: string; weight: number }[];
  threshold: number;
  createdAt: number;
}

export interface Store {
  schemaVersion: number;
  kycLeaves: KycLeaf[];
  kycRoot: string;
  revokedNullifiers: string[];
  spentNullifiers: string[];
  users: PublicAccount[];
  events: LedgerEvent[];
  vaults: RecoveryVaultMeta[];
  notes: EncryptedNote[];
  issuerSecret: string;
  /** CircleProof — pending challenges (public nonces, not secrets) */
  nyxproofChallenges?: Record<string, import("./nyxproof.js").CircleProofChallenge>;
  /** CircleProof — burned challenge nonces (single-use) */
  spentChallenges?: string[];
  issuanceRecords?: import("../compliance/services/kycIssuance.js").IssuanceRecord[];
  revocationEvents?: import("../compliance/services/revocation.js").RevocationEvent[];
  enrollmentSessions?: import("../compliance/services/enrollmentRelay.js").EnrollmentSession[];
  relayOpsLogs?: import("../compliance/services/settlementRelay.js").RelayOpsLog[];
  viewKeyCommitments?: Record<
    string,
    { commitment: string; issuedAt: number; dataClass: 1 }
  >;
  /** a26z-Brand verified-merchant-payment registries */
  brandRegistries?: Record<string, import("./verifiedMerchant.js").BrandRegistry>;
  merchantLeaves?: import("./verifiedMerchant.js").MerchantLeaf[];
  revokedVendorNullifiers?: string[];
  merchantChallenges?: Record<string, import("./verifiedMerchant.js").MerchantChallenge>;
  spentMerchantChallenges?: string[];
  /** Rail-agnostic transaction intent authorization (a26z-Brand) */
  txAuth?: import("../txAuth/registry.js").TxAuthState;
  /** Phase 10 — receiving-payment (JIT destinations + credit) */
  receivePay?: import("../receivePay/types.js").ReceivePayState;
  /** Circle Credit v1 — same-asset overcollateralized lending pool */
  circledCredit?: import("../credit/types.js").CreditState;
  /** Consumer dispute / refund coordination (metadata) */
  disputes?: import("./disputes.js").DisputeRecord[];
  /** KYC provider audit trail (Class 2 events only) */
  kycAudit?: {
    id: string;
    at: number;
    action: string;
    issuanceRef?: string;
    detail: string;
  }[];
  /** Durable P2P payment lifecycle (privacy-safe metadata) */
  paymentLifecycle?: import("./paymentLifecycle.js").PaymentLifecycleRecord[];
  /**
   * Universal adapter durable bucket (quotes/routes/payments/metrics/accounts/rail ledgers).
   * Additive on schema v4 — survives process restart for capped pilot.
   */
  universal?: import("./universalPersist.js").UniversalPersistBucket;
}

function emptyStore(): Store {
  return {
    schemaVersion: STORE_SCHEMA_VERSION,
    kycLeaves: [],
    kycRoot: sha256("empty"),
    revokedNullifiers: [],
    spentNullifiers: [],
    users: [],
    events: [],
    vaults: [],
    notes: [],
    issuerSecret: randomNonce(32),
    nyxproofChallenges: {},
    spentChallenges: [],
    issuanceRecords: [],
    revocationEvents: [],
    enrollmentSessions: [],
    relayOpsLogs: [],
    viewKeyCommitments: {},
    brandRegistries: {},
    merchantLeaves: [],
    revokedVendorNullifiers: [],
    merchantChallenges: {},
    spentMerchantChallenges: [],
  };
}

function recomputeRoot(store: Store) {
  const leaves = store.kycLeaves.filter((l) => !l.revoked).map((l) => l.leaf);
  store.kycRoot = merkleRoot(leaves.length ? leaves : [sha256("empty")]);
}

export function loadStore(): Store {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  const persisted = readPersistedStore() ?? migrateLegacyJsonStore();
  if (!persisted) {
    const s = emptyStore();
    saveStore(s);
    return s;
  }
  const raw = persisted as Store & {
    users?: Array<Record<string, unknown>>;
  };
  // Wipe pre-v3 stores that held Class 0 plaintext
  if (raw.schemaVersion !== STORE_SCHEMA_VERSION) {
    console.warn(
      `[circled] Migrating store schema ${raw.schemaVersion ?? 1} → ${STORE_SCHEMA_VERSION} (Class 0 wipe)`
    );
    const s = emptyStore();
    saveStore(s);
    return s;
  }
  // Guard: strip any leaked private fields from older bugs
  for (const u of raw.users ?? []) {
    delete u.privateKey;
    delete u.balance;
    delete u.balanceNonce;
    delete u.policy;
    delete u.contacts;
  }
  if (!raw.notes) raw.notes = [];
  if (!raw.nyxproofChallenges) raw.nyxproofChallenges = {};
  if (!raw.spentChallenges) raw.spentChallenges = [];
  if (!raw.brandRegistries) raw.brandRegistries = {};
  if (!raw.merchantLeaves) raw.merchantLeaves = [];
  if (!raw.revokedVendorNullifiers) raw.revokedVendorNullifiers = [];
  if (!raw.merchantChallenges) raw.merchantChallenges = {};
  if (!raw.spentMerchantChallenges) raw.spentMerchantChallenges = [];
  return raw as Store;
}

export function saveStore(store: Store) {
  store.schemaVersion = STORE_SCHEMA_VERSION;
  persistStore(store);
}

/** Close the SQLite handle — used by tests between isolated store paths. */
export function closeStore() {
  if (!db) return;
  db.close();
  db = null;
}

export function issueKyc(
  store: Store,
  input: {
    identityDocumentHash: string;
    jurisdiction: string;
    pubkey: string;
  }
): KycLeaf {
  const identityHash = input.identityDocumentHash;
  const issuerSig = hmacSign(
    store.issuerSecret,
    `${identityHash}|${input.jurisdiction}|true|true`
  );
  const leaf = sha256(
    `${identityHash}|${input.jurisdiction}|true|true|${issuerSig}`
  );
  const nullifier = sha256(`nf:${identityHash}`);
  const record: KycLeaf = {
    identityHash,
    jurisdiction: input.jurisdiction,
    sanctionsClear: true,
    accreditationFlag: true,
    issuerSig,
    leaf,
    nullifier,
    pubkey: input.pubkey,
    revoked: false,
  };
  store.kycLeaves.push(record);
  recomputeRoot(store);
  return record;
}

export function getKycProof(store: Store, leaf: string) {
  const active = store.kycLeaves.filter((l) => !l.revoked);
  const leaves = active.map((l) => l.leaf);
  const index = leaves.indexOf(leaf);
  if (index < 0) return null;
  return {
    root: store.kycRoot,
    proof: merkleProof(leaves, index),
    leaf,
  };
}

export function createPublicAccount(
  store: Store,
  input: {
    displayName: string;
    deviceId: string;
    kyc: KycLeaf;
    publicKeyJwk: JsonWebKey;
    balanceCommitment: string;
    policyCommitment: string;
    policyActive: string[];
  }
): PublicAccount {
  const pubkey = input.kyc.pubkey || pubkeyThumbprint(input.publicKeyJwk);
  const user: PublicAccount = {
    id: sha256(`user:${input.kyc.nullifier}:${Date.now()}`).slice(0, 16),
    displayName: input.displayName,
    deviceId: input.deviceId,
    pubkey,
    publicKeyJwk: input.publicKeyJwk,
    credentialCommitment: input.kyc.leaf,
    balanceCommitment: input.balanceCommitment,
    policyCommitment: input.policyCommitment,
    policyActive: input.policyActive,
    kycNullifier: input.kyc.nullifier,
    createdAt: Date.now(),
    class0DeviceOnly: true,
  };
  store.users.push(user);
  store.events.push({
    id: randomNonce(8),
    type: "kyc_commit",
    timestamp: Date.now(),
    delayedUntil: Date.now(),
    released: true,
    meta: { commitment: user.credentialCommitment },
  });
  return user;
}

export function publicUser(user: PublicAccount) {
  return {
    id: user.id,
    displayName: user.displayName,
    deviceId: user.deviceId,
    pubkey: user.pubkey,
    credentialCommitment: user.credentialCommitment,
    balanceCommitment: user.balanceCommitment,
    policyCommitment: user.policyCommitment,
    policyActive: user.policyActive,
    /** Params never returned — Class 0 on device */
    policyParams: null,
    contacts: [] as {
      label: string;
      displayContext: string;
      addressCommitment: string;
      hasEnrollmentSig: boolean;
    }[],
    createdAt: user.createdAt,
    class0DeviceOnly: true as const,
  };
}

// Keep commit available for any remaining server-side commitment checks
export { commit };
