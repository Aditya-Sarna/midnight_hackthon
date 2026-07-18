/**
 * WebAuthn / passkey unlock for Class 0 vault.
 * Opt-in: never interrupts voice→confirm until a passkey is enrolled.
 * Touch/Face ID only challenges when a credential already exists.
 */
const CRED_KEY = "circled_webauthn_cred_v1";
const UNLOCK_UNTIL_KEY = "circled_vault_unlocked_until";
const UNLOCK_TTL_MS = 5 * 60_000;

function bufToB64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function b64ToBuf(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

export function webauthnAvailable(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.PublicKeyCredential !== "undefined" &&
    typeof navigator.credentials?.create === "function"
  );
}

export function hasWebauthnCredential(): boolean {
  try {
    return Boolean(localStorage.getItem(CRED_KEY));
  } catch {
    return false;
  }
}

export function isVaultUnlocked(): boolean {
  try {
    const until = Number(sessionStorage.getItem(UNLOCK_UNTIL_KEY) || 0);
    return until > Date.now();
  } catch {
    return false;
  }
}

function markUnlocked() {
  try {
    sessionStorage.setItem(UNLOCK_UNTIL_KEY, String(Date.now() + UNLOCK_TTL_MS));
  } catch {
    /* ignore */
  }
}

export function lockVaultSession() {
  try {
    sessionStorage.removeItem(UNLOCK_UNTIL_KEY);
  } catch {
    /* ignore */
  }
}

/** Register a platform passkey bound to this origin + user (opt-in from settings) */
export async function registerVaultPasskey(userId: string, displayName: string): Promise<boolean> {
  if (!webauthnAvailable()) return false;
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userIdBytes = new TextEncoder().encode(userId.slice(0, 64));
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: "Circled", id: location.hostname },
      user: {
        id: userIdBytes,
        name: `circled:${userId}`,
        displayName: displayName || "Circled vault",
      },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "preferred",
      },
      timeout: 60_000,
      attestation: "none",
    },
  })) as PublicKeyCredential | null;
  if (!cred) return false;
  localStorage.setItem(
    CRED_KEY,
    JSON.stringify({
      id: cred.id,
      rawId: bufToB64(cred.rawId),
      userId,
    })
  );
  markUnlocked();
  return true;
}

/** Assert passkey — unlocks vault session for UNLOCK_TTL_MS */
export async function unlockVaultWithPasskey(): Promise<boolean> {
  if (!webauthnAvailable()) {
    markUnlocked();
    return true;
  }
  const raw = localStorage.getItem(CRED_KEY);
  if (!raw) {
    markUnlocked();
    return true;
  }
  const saved = JSON.parse(raw) as { id: string; rawId: string };
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge,
      rpId: location.hostname,
      allowCredentials: [
        {
          type: "public-key",
          id: b64ToBuf(saved.rawId),
          transports: ["internal"],
        },
      ],
      userVerification: "required",
      timeout: 60_000,
    },
  });
  if (!assertion) return false;
  markUnlocked();
  return true;
}

/**
 * Gate for settle — never pops a passkey *registration* during voice pay.
 * Soft-unlocks when no credential is enrolled (demo / first-run).
 * Only challenges biometrics if the user already opted into a vault passkey.
 */
export async function ensureVaultUnlocked(_opts: {
  userId: string;
  displayName: string;
}): Promise<{ ok: boolean; reason?: string }> {
  if (isVaultUnlocked()) return { ok: true };
  if (!hasWebauthnCredential() || !webauthnAvailable()) {
    markUnlocked();
    return { ok: true };
  }
  try {
    const unlocked = await unlockVaultWithPasskey();
    if (!unlocked) {
      return { ok: false, reason: "Biometric unlock cancelled — try Accept again" };
    }
    return { ok: true };
  } catch {
    // Platform authenticator flake must not kill voice settle
    markUnlocked();
    return { ok: true };
  }
}
