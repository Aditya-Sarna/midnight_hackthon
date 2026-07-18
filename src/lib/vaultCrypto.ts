/**
 * Production Class 0 wrap — non-extractable AES-GCM key in IndexedDB.
 * Migrates legacy plaintext localStorage wrap keys and deletes them.
 */
const IDB_NAME = "circled_vault_crypto_v4";
const IDB_STORE = "keys";
const IDB_KEY = "wrap";
const LEGACY_WRAP = "circled_wrap_v3";
const FALLBACK_SALT = "circled_wrap_salt_v4";

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

async function idbGet(): Promise<CryptoKey | null> {
  if (!idbAvailable()) return null;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    const req = tx.objectStore(IDB_STORE).get(IDB_KEY);
    req.onsuccess = () => resolve((req.result as CryptoKey) ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(key: CryptoKey): Promise<void> {
  if (!idbAvailable()) return;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(key, IDB_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function generateWrapKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, [
    "encrypt",
    "decrypt",
  ]);
}

/** PBKDF2 fallback when IndexedDB unavailable (tests / restricted browsers) */
async function fallbackKey(): Promise<CryptoKey> {
  let saltHex = localStorage.getItem(FALLBACK_SALT);
  if (!saltHex) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    saltHex = [...salt].map((b) => b.toString(16).padStart(2, "0")).join("");
    localStorage.setItem(FALLBACK_SALT, saltHex);
  }
  // Ephemeral material lives in sessionStorage — not durable plaintext wrap key
  let material = sessionStorage.getItem("circled_session_material_v4");
  if (!material) {
    const raw = crypto.getRandomValues(new Uint8Array(32));
    material = [...raw].map((b) => b.toString(16).padStart(2, "0")).join("");
    sessionStorage.setItem("circled_session_material_v4", material);
  }
  const baseKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(material),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  const salt = new Uint8Array(
    saltHex.match(/.{1,2}/g)!.map((h) => parseInt(h, 16))
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 310_000, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

let cached: CryptoKey | null = null;

export async function getVaultWrapKey(): Promise<CryptoKey> {
  if (cached) return cached;
  let key = await idbGet();
  if (!key) {
    key = idbAvailable() ? await generateWrapKey() : await fallbackKey();
    if (idbAvailable()) await idbPut(key);
  }
  cached = key;
  return key;
}

export async function encryptWithWrapKey(plaintext: string): Promise<string> {
  const key = await getVaultWrapKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext)
  );
  const out = new Uint8Array(12 + enc.byteLength);
  out.set(iv, 0);
  out.set(new Uint8Array(enc), 12);
  return btoa(String.fromCharCode(...out));
}

export async function decryptWithWrapKey(ciphertextB64: string): Promise<string> {
  const key = await getVaultWrapKey();
  const raw = Uint8Array.from(atob(ciphertextB64), (c) => c.charCodeAt(0));
  const iv = raw.slice(0, 12);
  const data = raw.slice(12);
  const dec = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return new TextDecoder().decode(dec);
}

/** Migrate vault ciphertext encrypted under legacy hex wrap key */
export async function migrateLegacyVaultCipher(
  ciphertextB64: string,
  aesDecryptHex: (ct: string, keyHex: string) => Promise<string>
): Promise<string | null> {
  const legacy = localStorage.getItem(LEGACY_WRAP);
  if (!legacy) return null;
  try {
    const plain = await aesDecryptHex(ciphertextB64, legacy);
    const next = await encryptWithWrapKey(plain);
    localStorage.removeItem(LEGACY_WRAP);
    return next;
  } catch {
    return null;
  }
}

export function clearVaultCrypto(): void {
  cached = null;
  localStorage.removeItem(LEGACY_WRAP);
  localStorage.removeItem(FALLBACK_SALT);
  try {
    sessionStorage.removeItem("circled_session_material_v4");
  } catch {
    /* ignore */
  }
  if (idbAvailable()) {
    try {
      indexedDB.deleteDatabase(IDB_NAME);
    } catch {
      /* ignore */
    }
  }
}
