/**
 * Compact-compatible balance commitments (persistentCommit<Field>).
 * Used by enterprise spend/credit circuits — not the legacy sha256 nyx:commit scheme.
 */
import { randomBytes } from "node:crypto";
import { CompactTypeField, persistentCommit } from "@midnight-ntwrk/compact-runtime";

export function compactBalanceCommit(balance: bigint | number, opening: Uint8Array): string {
  const bal = typeof balance === "bigint" ? balance : BigInt(Math.trunc(balance));
  const commit = persistentCommit(CompactTypeField, bal, opening);
  return Buffer.from(commit).toString("hex");
}

export function randomOpening(): Uint8Array {
  return randomBytes(32);
}

export function openingToHex(opening: Uint8Array): string {
  return Buffer.from(opening).toString("hex");
}

export function hexToOpening(hex: string): Uint8Array {
  const clean = hex.replace(/^0x/, "");
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2) || "00", 16);
  }
  return out;
}
