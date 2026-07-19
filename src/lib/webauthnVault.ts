/**
 * WebAuthn / passkey unlock for Class 0 vault.
 * High-value settles require biometric when enrolled (or when requireBiometric is set).
 */
const CRED_KEY = "circled_webauthn_cred_v1";
const UNLOCK_UNTIL_KEY = "circled_vault_unlocked_until";
/** Production-leaning default: 2m soft session; demos still soft-unlock without passkey */
const UNLOCK_TTL_MS =
  typeof import.meta !== "undefined" &&
  (import.meta as { env?: { PROD?: boolean } }).env?.PROD
    ? 2 * 60_000
    : 5 * 60_000;

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

/** Soft-lock vault session (e.g. app backgrounded) */
export function lockVaultSession() {
  try {
    sessionStorage.removeItem(UNLOCK_UNTIL_KEY);
  } catch {
    /* ignore */
  }
}

/** Register a platform passkey bound to this origin + user (Settings → Security) */
export async function registerVaultPasskey(userId: string, displayName: string): Promise<boolean> {
  if (!webauthnAvailable()) return false;
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userIdBytes = new TextEncoder().encode(userId.slice(0, 64));
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: "Circle", id: location.hostname },
      user: {
        id: userIdBytes,
        name: `circled:${userId}`,
        displayName: displayName || "Circle vault",
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
  if (!webauthnAvailable()) return false;
  const raw = localStorage.getItem(CRED_KEY);
  if (!raw) return false;
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
 * Gate for settle.
 * - Default: soft-unlock if no passkey enrolled (first-run / demo).
 * - requireBiometric: fail-closed unless passkey assertion succeeds (high-value).
 */
export async function ensureVaultUnlocked(opts: {
  userId: string;
  displayName: string;
  requireBiometric?: boolean;
}): Promise<{ ok: boolean; reason?: string; stepUp?: { kind: "passkey"; at: number } }> {
  if (isVaultUnlocked() && !opts.requireBiometric) return { ok: true };
  if (isVaultUnlocked() && opts.requireBiometric && hasWebauthnCredential()) {
    // Still re-challenge for high-value
  } else if (isVaultUnlocked() && opts.requireBiometric && !hasWebauthnCredential()) {
    return {
      ok: false,
      reason: "Enroll a vault passkey in Settings before high-value payments",
    };
  }

  if (!opts.requireBiometric && (!hasWebauthnCredential() || !webauthnAvailable())) {
    markUnlocked();
    return { ok: true };
  }

  if (opts.requireBiometric && !hasWebauthnCredential()) {
    return {
      ok: false,
      reason: "Enroll a vault passkey in Settings before high-value payments",
    };
  }

  if (!webauthnAvailable()) {
    if (opts.requireBiometric) {
      return { ok: false, reason: "Biometrics unavailable on this device" };
    }
    markUnlocked();
    return { ok: true };
  }

  try {
    const unlocked = await unlockVaultWithPasskey();
    if (!unlocked) {
      return { ok: false, reason: "Biometric unlock cancelled — try Accept again" };
    }
    return {
      ok: true,
      stepUp: { kind: "passkey", at: Date.now() },
    };
  } catch {
    if (opts.requireBiometric) {
      return { ok: false, reason: "Biometric unlock failed — try again" };
    }
    markUnlocked();
    return { ok: true };
  }
}
