/**
 * Server-side ECDSA P-256 verify — never needs the private key (Class 0).
 */
import { createPublicKey, verify, createHash, randomBytes } from "node:crypto";

export function sha256(input: string | Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}

export function randomNonce(bytes = 16): string {
  return randomBytes(bytes).toString("hex");
}

export function verifyEcdsaSignature(
  publicKeyJwk: JsonWebKey,
  message: string,
  signatureHex: string
): boolean {
  try {
    const key = createPublicKey({ key: publicKeyJwk as object, format: "jwk" });
    const sig = Buffer.from(signatureHex, "hex");
    return verify(
      "sha256",
      Buffer.from(message, "utf8"),
      { key, dsaEncoding: "ieee-p1363" },
      sig
    );
  } catch {
    return false;
  }
}

export function pubkeyThumbprint(publicKeyJwk: JsonWebKey): string {
  // Stable identity from JWK x||y
  return sha256(`jwk:${publicKeyJwk.x}:${publicKeyJwk.y}`);
}
