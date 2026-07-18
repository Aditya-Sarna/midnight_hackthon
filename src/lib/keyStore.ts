/**
 * Class 0 signing keys — non-extractable CryptoKeys in IndexedDB.
 * Keys are stored under a stable `pk:<pubkey>` ref AND under userId aliases
 * (tmp → server id rebinding after register).
 */
const IDB_NAME = "circled_keystore_v1";
const IDB_STORE = "keys";

export type StoredDeviceKeys = {
  signPrivate: CryptoKey;
  encPrivate: CryptoKey;
};

export function keyRefForPubkey(pubkey: string): string {
  return `pk:${pubkey}`;
}

function idbAvailable(): boolean {
  try {
    return typeof indexedDB !== "undefined";
  } catch {
    return false;
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(id: string): Promise<StoredDeviceKeys | null> {
  if (!idbAvailable()) return null;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    const req = tx.objectStore(IDB_STORE).get(id);
    req.onsuccess = () => resolve((req.result as StoredDeviceKeys) ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(id: string, keys: StoredDeviceKeys): Promise<void> {
  if (!idbAvailable()) return;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(keys, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

const memCache = new Map<string, StoredDeviceKeys>();

/** Persist non-extractable private keys under one or more ids */
export async function putDeviceKeys(id: string, keys: StoredDeviceKeys): Promise<void> {
  memCache.set(id, keys);
  await idbPut(id, keys);
}

/**
 * Seal keys under stable pubkey ref + optional userId alias.
 * Pubkey ref survives tmp → server userId rebinding.
 */
export async function sealDeviceKeys(
  keys: StoredDeviceKeys,
  pubkey: string,
  userId?: string
): Promise<string> {
  const keyRef = keyRefForPubkey(pubkey);
  await putDeviceKeys(keyRef, keys);
  if (userId) await putDeviceKeys(userId, keys);
  return keyRef;
}

export async function getDeviceKeys(id: string): Promise<StoredDeviceKeys | null> {
  const hit = memCache.get(id);
  if (hit) return hit;
  const fromIdb = await idbGet(id);
  if (fromIdb) memCache.set(id, fromIdb);
  return fromIdb;
}

/** Resolve keys by userId and/or stable pubkey ref */
export async function resolveDeviceKeys(opts: {
  userId?: string;
  pubkey?: string;
  keyRef?: string;
}): Promise<StoredDeviceKeys | null> {
  const ids = [
    opts.keyRef,
    opts.pubkey ? keyRefForPubkey(opts.pubkey) : undefined,
    opts.userId,
  ].filter(Boolean) as string[];
  for (const id of ids) {
    const keys = await getDeviceKeys(id);
    if (keys) return keys;
  }
  return null;
}

/** After server assigns real userId — alias keys from tmp id (and keep pk: ref) */
export async function bindDeviceKeysToUser(opts: {
  fromUserId?: string;
  toUserId: string;
  pubkey: string;
}): Promise<boolean> {
  const keys = await resolveDeviceKeys({
    userId: opts.fromUserId,
    pubkey: opts.pubkey,
  });
  if (!keys) return false;
  await sealDeviceKeys(keys, opts.pubkey, opts.toUserId);
  if (opts.fromUserId && opts.fromUserId !== opts.toUserId) {
    memCache.delete(opts.fromUserId);
    if (idbAvailable()) {
      const db = await openDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, "readwrite");
        tx.objectStore(IDB_STORE).delete(opts.fromUserId!);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }
  }
  return true;
}

/** One-time: import extractable JWKs as non-extractable keys */
export async function migrateJwksToKeyStore(
  userId: string,
  privateKeyJwk: JsonWebKey,
  encPrivateKeyJwk: JsonWebKey,
  pubkey?: string
): Promise<void> {
  const existing = await resolveDeviceKeys({ userId, pubkey });
  if (existing) {
    if (pubkey) await sealDeviceKeys(existing, pubkey, userId);
    return;
  }

  const signPrivate = await crypto.subtle.importKey(
    "jwk",
    privateKeyJwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
  const encPrivate = await crypto.subtle.importKey(
    "jwk",
    encPrivateKeyJwk,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    ["deriveBits"]
  );
  const keys = { signPrivate, encPrivate };
  if (pubkey) await sealDeviceKeys(keys, pubkey, userId);
  else await putDeviceKeys(userId, keys);
}

export async function clearDeviceKeys(userId?: string): Promise<void> {
  if (userId) {
    memCache.delete(userId);
  } else {
    memCache.clear();
  }
  if (!idbAvailable()) return;
  if (!userId) {
    try {
      indexedDB.deleteDatabase(IDB_NAME);
    } catch {
      /* ignore */
    }
    return;
  }
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).delete(userId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function signWithDeviceKey(
  lookup: { userId?: string; pubkey?: string; keyRef?: string },
  message: string
): Promise<string | null> {
  const keys = await resolveDeviceKeys(lookup);
  if (!keys) return null;
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    keys.signPrivate,
    new TextEncoder().encode(message)
  );
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function decryptNoteWithDeviceKey(
  lookup: { userId?: string; pubkey?: string; keyRef?: string },
  ephemeralPublicKeyJwk: JsonWebKey,
  ciphertext: string,
  aesDecrypt: (ct: string, keyHex: string) => Promise<string>,
  sha256: (input: string | Uint8Array) => Promise<string>
): Promise<object | null> {
  const keys = await resolveDeviceKeys(lookup);
  if (!keys) return null;
  const ephPub = await crypto.subtle.importKey(
    "jwk",
    ephemeralPublicKeyJwk,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "ECDH", public: ephPub },
    keys.encPrivate,
    256
  );
  const keyHex = await sha256(new Uint8Array(bits));
  return JSON.parse(await aesDecrypt(ciphertext, keyHex));
}
