/**
 * Passphrase recovery kit — portable Class 0 restore (keys + vault) without the old wrap key.
 */
import type { DeviceVaultState } from "./deviceVault";
import { migrateJwksToKeyStore } from "./keyStore";
import { saveVault } from "./deviceVault";

const KIT_VERSION = 1 as const;
const KIT_PREFIX = "circle-recovery-kit-v1:";

export type RecoveryKitPayload = {
  v: typeof KIT_VERSION;
  userId: string;
  displayName: string;
  createdAt: number;
  vault: DeviceVaultState;
  privateKeyJwk: JsonWebKey;
  encPrivateKeyJwk: JsonWebKey;
};

function b64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function fromB64(s: string): Uint8Array {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

async function deriveKitKey(
  passphrase: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 310_000, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/** Encrypt vault + private JWKs under the user's recovery passphrase */
export async function sealRecoveryKit(input: {
  vault: DeviceVaultState;
  privateKeyJwk: JsonWebKey;
  encPrivateKeyJwk: JsonWebKey;
  passphrase: string;
}): Promise<string> {
  const pass = input.passphrase.trim();
  if (pass.length < 8) throw new Error("Recovery passphrase must be at least 8 characters");

  const payload: RecoveryKitPayload = {
    v: KIT_VERSION,
    userId: input.vault.userId,
    displayName: input.vault.displayName,
    createdAt: Date.now(),
    vault: {
      ...input.vault,
      keypair: {
        publicKeyJwk: input.vault.keypair.publicKeyJwk,
        pubkey: input.vault.keypair.pubkey,
        encPublicKeyJwk: input.vault.keypair.encPublicKeyJwk,
        sealed: true,
        keyRef: input.vault.keypair.keyRef,
      },
      demoPeerVaults: undefined,
    },
    privateKeyJwk: input.privateKeyJwk,
    encPrivateKeyJwk: input.encPrivateKeyJwk,
  };

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKitKey(pass, salt);
  const enc = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(JSON.stringify(payload))
  );
  const body = b64(new Uint8Array(enc));
  return `${KIT_PREFIX}${b64(salt)}.${b64(iv)}.${body}`;
}

export async function openRecoveryKit(
  kit: string,
  passphrase: string
): Promise<RecoveryKitPayload> {
  const raw = kit.trim();
  if (!raw.startsWith(KIT_PREFIX)) {
    throw new Error("Not a Circle recovery kit");
  }
  const rest = raw.slice(KIT_PREFIX.length);
  const [saltB64, ivB64, bodyB64] = rest.split(".");
  if (!saltB64 || !ivB64 || !bodyB64) throw new Error("Recovery kit is corrupt");
  const key = await deriveKitKey(passphrase.trim(), fromB64(saltB64));
  try {
    const dec = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromB64(ivB64) },
      key,
      fromB64(bodyB64)
    );
    const payload = JSON.parse(new TextDecoder().decode(dec)) as RecoveryKitPayload;
    if (payload.v !== KIT_VERSION || !payload.vault?.userId) {
      throw new Error("Unsupported recovery kit");
    }
    return payload;
  } catch {
    throw new Error("Wrong passphrase or corrupt recovery kit");
  }
}

/** Restore Class 0 keys + vault from a passphrase kit onto this device */
export async function restoreFromRecoveryKit(
  kit: string,
  passphrase: string
): Promise<{ userId: string; vault: DeviceVaultState }> {
  const payload = await openRecoveryKit(kit, passphrase);
  await migrateJwksToKeyStore(
    payload.vault.userId,
    payload.privateKeyJwk,
    payload.encPrivateKeyJwk,
    payload.vault.keypair.pubkey
  );
  const vault: DeviceVaultState = {
    ...payload.vault,
    keypair: {
      ...payload.vault.keypair,
      sealed: true,
      privateKeyJwk: undefined,
      encPrivateKeyJwk: undefined,
    },
  };
  await saveVault(vault, { activate: true });
  try {
    localStorage.setItem(`circle_recovery_kit_${vault.userId}`, kit);
  } catch {
    /* ignore */
  }
  return { userId: vault.userId, vault };
}

export function downloadRecoveryKit(kit: string, displayName: string): void {
  const blob = new Blob([kit], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `circle-recovery-${displayName.replace(/\s+/g, "-").toLowerCase() || "wallet"}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

export function isRecoveryKit(text: string): boolean {
  return text.trim().startsWith(KIT_PREFIX);
}
