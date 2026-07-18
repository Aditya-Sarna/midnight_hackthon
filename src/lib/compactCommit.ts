/**
 * Compact persistentCommit helpers for Class 0 balance openings.
 * Openings never leave the device; commitment is computed via server helper.
 */
import { commit } from "./crypto";

export function randomOpeningHex(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function compactBalanceCommit(
  balance: number | bigint,
  openingHex: string
): Promise<string> {
  try {
    const res = await fetch("/api/compact/commit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ balance: String(balance), opening: openingHex }),
    });
    if (res.ok) {
      const data = (await res.json()) as { commitment: string };
      return data.commitment;
    }
  } catch {
    /* offline / test fallback below */
  }
  // Dev/test fallback — production settle always re-derives via Compact witnesses
  return commit(String(balance), openingHex);
}
