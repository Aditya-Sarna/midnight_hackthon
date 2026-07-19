/**
 * Crisp asset model for Circle (judge + product one-liner).
 *
 * What moves today:
 * - Class 0 free balance in CIRCLE_UNITS (integer product units on device)
 * - Public Compact ledger: balance commitments / nullifiers (not plaintext)
 * - Midnight gold path: Compact + proof-server SNARKs; optional Preprod tDUST for fees/broadcast
 *
 * What this is NOT (yet): licensed INR ACH, UPI PSP, or Circle USDC.
 */

export const ASSET = {
  id: "CIRCLE_UNIT",
  symbol: "CIRCLE",
  name: "Circle product unit",
  decimals: 0,
  kind: "product_unit" as const,
  ledger: "midnight-compact" as const,
  /** Optional chain fee / broadcast asset when Preprod wallet is configured */
  networkFeeAsset: "tDUST",
  oneLiner:
    "Class 0 CIRCLE product units on the device vault; public side is Compact balance commitments. Not INR ACH / UPI / USDC — Midnight gold path is Compact + proof-server SNARKs; Preprod tDUST only for optional on-chain broadcast fees.",
} as const;

export type AssetId = typeof ASSET.id;

export function assetLabel(amount: number): string {
  return `${Math.floor(amount).toLocaleString()} ${ASSET.symbol}`;
}
