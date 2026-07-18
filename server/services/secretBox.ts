/**
 * Encrypt merchant signing material at rest (AES-256-GCM via MERCHANT_KEK).
 */
import { decryptBundle, encryptBundle } from "./crypto.js";
import { loadConfig } from "../config.js";

const PREFIX = "enc:v1:";

export function sealSecret(plaintext: string): string {
  if (!plaintext || plaintext.startsWith(PREFIX)) return plaintext;
  const { merchantKek } = loadConfig();
  return PREFIX + encryptBundle(plaintext, merchantKek);
}

export function openSecret(sealed: string): string {
  if (!sealed) return sealed;
  if (!sealed.startsWith(PREFIX)) return sealed; // legacy plaintext migration
  const { merchantKek } = loadConfig();
  return decryptBundle(sealed.slice(PREFIX.length), merchantKek);
}

export function isSealed(value: string): boolean {
  return value.startsWith(PREFIX);
}
