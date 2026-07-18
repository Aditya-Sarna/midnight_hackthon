/**
 * On-chain Preprod settlement bridge.
 * Compact-runtime ledger is always advanced on settle.
 * Preprod broadcast requires MIDNIGHT_WALLET_SEED + MIDNIGHT_CONTRACT_ADDRESS + proof-server.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { requireMidnight } from "./midnight.js";
import { artifactsPresent, MANAGED_DIR } from "./compactLedger.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEPLOY_PATH = join(__dirname, "../../data/onchain-deployment.json");

export type OnChainReceipt = {
  status: "submitted" | "ready-unfunded" | "local-compact-ledger";
  network: string;
  contractAddress?: string;
  txId?: string;
  detail: string;
};

type DeploymentFile = {
  contractAddress?: string;
  deployedAt?: number | string;
  network?: string;
  lastTxId?: string;
  txId?: string;
  faucetTxId?: string;
  txKind?: string;
  unshieldedAddress?: string;
};

function loadDeployment(): DeploymentFile {
  if (!existsSync(DEPLOY_PATH)) return {};
  try {
    return JSON.parse(readFileSync(DEPLOY_PATH, "utf8")) as DeploymentFile;
  } catch {
    return {};
  }
}

export function saveDeployment(d: DeploymentFile) {
  mkdirSync(dirname(DEPLOY_PATH), { recursive: true });
  writeFileSync(DEPLOY_PATH, JSON.stringify(d, null, 2));
}

export function onchainConfigStatus() {
  const cfg = requireMidnight();
  const envAddr = process.env.MIDNIGHT_CONTRACT_ADDRESS?.trim();
  const file = loadDeployment();
  const seed =
    process.env.MIDNIGHT_WALLET_SEED?.trim() ||
    (existsSync(join(__dirname, "../../data/wallet-seed.local"))
      ? "configured-local"
      : "");
  const address = envAddr || file.contractAddress;
  return {
    artifactsOk: artifactsPresent(),
    managedDir: MANAGED_DIR,
    contractAddress: address ?? null,
    txId: file.lastTxId || file.txId || null,
    txKind: file.txKind ?? null,
    walletSeedConfigured: Boolean(seed),
    network: cfg.networkId,
    node: cfg.node,
    indexer: cfg.indexer,
    faucet: cfg.faucet,
    readyForSubmit: Boolean(file.txId || (address && seed)),
  };
}

export async function settleOnChainIfConfigured(input: {
  circuit: string;
  proofMode: string;
  snarkDigests?: Record<string, string>;
  compactLedger?: {
    spentNullifierCount?: string;
    transferCount?: string;
    spentChallengeCount?: string;
    creditCount?: string;
  };
}): Promise<OnChainReceipt> {
  const cfg = requireMidnight();
  const status = onchainConfigStatus();
  const { broadcastSettlement } = await import("./preprodBroadcast.js");
  const broadcast = await broadcastSettlement({
    circuit: input.circuit,
    snarkDigests: input.snarkDigests,
    compactLedger: input.compactLedger,
  });

  if (broadcast.status === "submitted") {
    return {
      status: "submitted",
      network: cfg.networkId,
      contractAddress: status.contractAddress ?? undefined,
      txId: broadcast.txId,
      detail: broadcast.detail,
    };
  }
  if (broadcast.status === "requires_funding" || broadcast.status === "failed") {
    return {
      status: "ready-unfunded",
      network: cfg.networkId,
      contractAddress: status.contractAddress ?? undefined,
      detail: broadcast.detail,
    };
  }

  return {
    status: "local-compact-ledger",
    network: cfg.networkId,
    contractAddress: status.contractAddress ?? undefined,
    detail: broadcast.detail,
  };
}

export async function deployStatus() {
  return {
    ...onchainConfigStatus(),
    deployment: loadDeployment(),
  };
}
