/**
 * Browser Class 0 crypto — keys, balances, and openings never leave the device.
 * Uses Web Crypto (SubtleCrypto) for ECDSA P-256 + AES-GCM + SHA-256.
 * Private keys are non-extractable in IndexedDB when generated with a userId.
 */
import { sealDeviceKeys, signWithDeviceKey } from "./keyStore";

function bufToHex(buf: ArrayBuffer | Uint8Array): string {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return [...u8].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function hexToBuf(hex: string): Uint8Array {
  const clean = hex.length % 2 ? `0${hex}` : hex;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export async function sha256(input: string | Uint8Array): Promise<string> {
  const data =
    typeof input === "string" ? new TextEncoder().encode(input) : input;
  return bufToHex(await crypto.subtle.digest("SHA-256", data));
}

export async function commit(value: string | number, nonce: string): Promise<string> {
  return sha256(`nyx:commit:${value}:${nonce}`);
}

export function randomNonce(bytes = 16): string {
  const u8 = crypto.getRandomValues(new Uint8Array(bytes));
  return bufToHex(u8);
}

export type DeviceKeypair = {
  /** Legacy only — wiped after migrate to IndexedDB keystore */
  privateKeyJwk?: JsonWebKey;
  publicKeyJwk: JsonWebKey;
  pubkey: string;
  /** Legacy only — wiped after migrate */
  encPrivateKeyJwk?: JsonWebKey;
  encPublicKeyJwk: JsonWebKey;
  /** True when private material lives in non-extractable IDB keys */
  sealed?: boolean;
  /** Stable IndexedDB key ref (`pk:<pubkey>`) — survives userId rebinding */
  keyRef?: string;
};

export type GeneratedKeypair = {
  keypair: DeviceKeypair;
  /** One-shot JWKs for passphrase recovery kit — discard after sealing the kit */
  recoveryJwks?: {
    privateKeyJwk: JsonWebKey;
    encPrivateKeyJwk: JsonWebKey;
  };
};

/**
 * Generate device keys. Pass userId to seal privates as non-extractable CryptoKeys (production).
 * Always generates extractable first so a one-shot recovery JWK export exists for the kit.
 */
export async function generateKeypair(userId?: string): Promise<DeviceKeypair> {
  const out = await generateKeypairWithRecovery(userId);
  return out.keypair;
}

export async function generateKeypairWithRecovery(
  userId?: string
): Promise<GeneratedKeypair> {
  const seal = Boolean(userId);
  // Extractable so we can export JWKs once into a passphrase kit, then re-import non-extractable.
  const pair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"]
  );
  const enc = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );
  const publicKeyJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  const encPublicKeyJwk = await crypto.subtle.exportKey("jwk", enc.publicKey);
  const privateKeyJwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  const encPrivateKeyJwk = await crypto.subtle.exportKey("jwk", enc.privateKey);
  const spki = await crypto.subtle.exportKey("spki", pair.publicKey);
  const pubkey = await sha256(new Uint8Array(spki));

  if (seal && userId) {
    // Re-import as non-extractable for day-to-day Class 0 use
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
    const keyRef = await sealDeviceKeys(
      { signPrivate, encPrivate },
      pubkey,
      userId
    );
    return {
      keypair: {
        publicKeyJwk,
        pubkey,
        encPublicKeyJwk,
        sealed: true,
        keyRef,
      },
      recoveryJwks: { privateKeyJwk, encPrivateKeyJwk },
    };
  }

  return {
    keypair: {
      privateKeyJwk,
      publicKeyJwk,
      pubkey,
      encPrivateKeyJwk,
      encPublicKeyJwk,
      sealed: false,
    },
    recoveryJwks: { privateKeyJwk, encPrivateKeyJwk },
  };
}

export async function signMessage(
  privateKeyJwk: JsonWebKey | undefined,
  message: string,
  userId?: string,
  pubkey?: string
): Promise<string> {
  if (userId || pubkey) {
    const sealed = await signWithDeviceKey({ userId, pubkey }, message);
    if (sealed) return sealed;
  }
  if (!privateKeyJwk) {
    throw new Error(
      "Signing key unavailable — vault keystore locked. Clear site data and re-onboard once to rebind keys."
    );
  }
  const key = await crypto.subtle.importKey(
    "jwk",
    privateKeyJwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(message)
  );
  return bufToHex(sig);
}

export async function verifyMessage(
  publicKeyJwk: JsonWebKey,
  message: string,
  signatureHex: string
): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey(
      "jwk",
      publicKeyJwk,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"]
    );
    return crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      hexToBuf(signatureHex),
      new TextEncoder().encode(message)
    );
  } catch {
    return false;
  }
}

export async function aesEncrypt(plaintext: string, keyHex: string): Promise<string> {
  const keyBytes = hexToBuf(keyHex.padEnd(64, "0").slice(0, 64)).slice(0, 32);
  const key = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt"]);
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

export async function aesDecrypt(ciphertextB64: string, keyHex: string): Promise<string> {
  const keyBytes = hexToBuf(keyHex.padEnd(64, "0").slice(0, 64)).slice(0, 32);
  const key = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["decrypt"]);
  const raw = Uint8Array.from(atob(ciphertextB64), (c) => c.charCodeAt(0));
  const iv = raw.slice(0, 12);
  const data = raw.slice(12);
  const dec = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return new TextDecoder().decode(dec);
}

/** Encrypt a payment note to recipient using ECDH P-256 */
export async function encryptNoteToRecipient(
  recipientEncPublicKeyJwk: JsonWebKey,
  payload: object
): Promise<{ ephemeralPublicKeyJwk: JsonWebKey; ciphertext: string }> {
  const eph = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );
  const theirKey = await crypto.subtle.importKey(
    "jwk",
    recipientEncPublicKeyJwk,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "ECDH", public: theirKey },
    eph.privateKey,
    256
  );
  const keyHex = await sha256(new Uint8Array(bits));
  const ciphertext = await aesEncrypt(JSON.stringify(payload), keyHex);
  const ephemeralPublicKeyJwk = await crypto.subtle.exportKey("jwk", eph.publicKey);
  return { ephemeralPublicKeyJwk, ciphertext };
}

export async function decryptNoteFromSender(
  encPrivateKeyJwk: JsonWebKey | undefined,
  ephemeralPublicKeyJwk: JsonWebKey,
  ciphertext: string,
  userId?: string
): Promise<object> {
  if (userId) {
    const { decryptNoteWithDeviceKey } = await import("./keyStore");
    const sealed = await decryptNoteWithDeviceKey(
      { userId },
      ephemeralPublicKeyJwk,
      ciphertext,
      aesDecrypt,
      sha256
    );
    if (sealed) return sealed;
  }
  if (!encPrivateKeyJwk) {
    throw new Error("Encryption key unavailable — vault keystore locked");
  }
  const priv = await crypto.subtle.importKey(
    "jwk",
    encPrivateKeyJwk,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    ["deriveBits"]
  );
  const ephPub = await crypto.subtle.importKey(
    "jwk",
    ephemeralPublicKeyJwk,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "ECDH", public: ephPub },
    priv,
    256
  );
  const keyHex = await sha256(new Uint8Array(bits));
  return JSON.parse(await aesDecrypt(ciphertext, keyHex));
}

/**
 * Client intent-binding transcript — NOT a SNARK.
 * Server Compact execution (and optional proof-server) is authoritative.
 */
export async function makeProof(
  kind: string,
  publicInputs: Record<string, string>,
  privateDigest: string
) {
  const transcript = await sha256(
    JSON.stringify({ kind, publicInputs, privateDigest, v: "circled-v4-intent" })
  );
  return {
    protocol: "circled-intent-binding/1",
    circuit: kind,
    publicInputs,
    proof: transcript,
    /** Client never self-attests ZK validity */
    verified: false as const,
    grade: "client_intent_binding" as const,
    generatedAt: Date.now(),
    class0: true as const,
  };
}

export { bufToHex, hexToBuf };
