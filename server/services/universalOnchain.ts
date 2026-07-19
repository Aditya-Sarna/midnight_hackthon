import { sha256 } from "./crypto.js";
import { broadcastSettlement } from "./preprodBroadcast.js";

export type UniversalOnchainSettlement = {
  status: "submitted" | "unavailable";
  network: string;
  txHash?: string;
  txKind?: "contract-call" | "unshielded-transfer";
  settlementId?: string;
  settlementBinding: string;
  receiptBinding?: string;
  submittedAt?: number;
  detail: string;
};

export function universalSettlementBinding(input: {
  intentCommitment: string;
  routeCommitment: string;
  sourceSettlementId: string;
  targetSettlementId: string;
  proofBindingDigest?: string;
}): string {
  return sha256(
    [
      "uni:onchain-settlement:v1",
      input.intentCommitment,
      input.routeCommitment,
      input.sourceSettlementId,
      input.targetSettlementId,
      input.proofBindingDigest ?? "",
    ].join("|")
  );
}

export function universalReceiptBinding(input: {
  settlementBinding: string;
  settlementId: string;
  txHash: string;
  network: string;
}): string {
  return sha256(
    [
      "uni:onchain-receipt:v1",
      input.settlementBinding,
      input.settlementId,
      input.txHash,
      input.network,
    ].join("|")
  );
}

/**
 * Submit a unique Midnight Preprod transaction and bind its network hash to
 * the exact universal route, rail settlements, and proof digest.
 */
export async function submitUniversalOnchainSettlement(input: {
  intentCommitment: string;
  routeCommitment: string;
  sourceSettlementId: string;
  targetSettlementId: string;
  proofBindingDigest?: string;
  snarkDigest?: string;
}): Promise<UniversalOnchainSettlement | undefined> {
  const enabled = process.env.NYXPAY_UNIVERSAL_TESTNET_TX === "1";
  if (!enabled || process.env.VITEST) return undefined;

  const settlementBinding = universalSettlementBinding(input);
  const broadcast = await broadcastSettlement({
    circuit: "prove_authorized_transaction",
    snarkDigests: input.snarkDigest
      ? { prove_authorized_transaction: input.snarkDigest }
      : undefined,
    settlementBinding,
    requireSubmitted: process.env.NYXPAY_UNIVERSAL_REQUIRE_TESTNET_TX === "1",
  });

  if (broadcast.status !== "submitted" || !broadcast.txId || !broadcast.settlementId) {
    return {
      status: "unavailable",
      network: broadcast.network,
      settlementBinding,
      detail: broadcast.detail,
    };
  }

  const submittedAt = Date.now();
  return {
    status: "submitted",
    network: broadcast.network,
    txHash: broadcast.txId,
    txKind:
      broadcast.kind === "contract-call" || broadcast.kind === "unshielded-transfer"
        ? broadcast.kind
        : undefined,
    settlementId: broadcast.settlementId,
    settlementBinding,
    receiptBinding: universalReceiptBinding({
      settlementBinding,
      settlementId: broadcast.settlementId,
      txHash: broadcast.txId,
      network: broadcast.network,
    }),
    submittedAt,
    detail: broadcast.detail,
  };
}