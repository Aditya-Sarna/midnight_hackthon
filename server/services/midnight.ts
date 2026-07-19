/**
 * Midnight Foundation integration — compulsory for Circle.
 * Official packages + Preprod endpoints from Midnight docs:
 * https://docs.midnight.network/sdks/official/midnight-js
 */
import { setNetworkId, getNetworkId } from "@midnight-ntwrk/midnight-js-network-id";

export type MidnightNetwork = "preprod" | "preview" | "undeployed" | "mainnet";

/** Official Midnight Foundation endpoints */
export const MIDNIGHT_CONFIG = {
  preprod: {
    networkId: "preprod" as const,
    indexer: "https://indexer.preprod.midnight.network/api/v4/graphql",
    indexerReady: "https://indexer.preprod.midnight.network/ready",
    indexerWS: "wss://indexer.preprod.midnight.network/api/v4/graphql/ws",
    node: "https://rpc.preprod.midnight.network",
    proofServer: process.env.MIDNIGHT_PROOF_SERVER_URL || "http://127.0.0.1:6300",
    faucet: "https://faucet.preprod.midnight.network",
    docs: "https://docs.midnight.network",
    brand: "https://midnight.network/brand-hub",
    compactContract: "contracts/nyxpay.compact",
    proofServerImage: "midnightntwrk/proof-server:8.0.3",
  },
} as const;

let initialized = false;

export function initMidnightFoundation(network: MidnightNetwork = "preprod") {
  setNetworkId(network);
  const id = getNetworkId();
  if (!id) throw new Error("Midnight Foundation network id failed to initialize");
  initialized = true;
  return {
    networkId: id,
    config: MIDNIGHT_CONFIG.preprod,
    packages: [
      "@midnight-ntwrk/midnight-js-network-id",
      "@midnight-ntwrk/midnight-js-types",
      "@midnight-ntwrk/ledger-v8",
      "@midnight-ntwrk/midnight-js-compact",
      "@midnight-ntwrk/midnight-js-contracts",
      "@midnight-ntwrk/midnight-js-http-client-proof-provider",
      "@midnight-ntwrk/midnight-js-node-zk-config-provider",
      "@midnight-ntwrk/midnight-js-indexer-public-data-provider",
      "@midnight-ntwrk/compact-runtime",
    ],
  };
}

export function requireMidnight() {
  if (!initialized) initMidnightFoundation("preprod");
  return MIDNIGHT_CONFIG.preprod;
}

export type MidnightHealth = {
  foundation: true;
  networkId: string;
  indexer: { ok: boolean; detail: string };
  node: { ok: boolean; detail: string };
  proofServer: { ok: boolean; detail: string };
  compactContract: string;
  compactArtifacts: { ok: boolean; detail: string };
  packages: string[];
  compulsory: true;
};

export async function probeMidnightFoundation(): Promise<MidnightHealth> {
  const boot = initMidnightFoundation("preprod");
  const cfg = boot.config;

  const [indexer, node, proofServer] = await Promise.all([
    probeUrl(cfg.indexerReady, "indexer"),
    probeRpc(cfg.node),
    probeUrl(`${cfg.proofServer}/health`, "proof-server"),
  ]);

  const { artifactsPresent, listCircuitArtifacts } = await import("./compactLedger.js");
  const artifactsOk = artifactsPresent();

  return {
    foundation: true,
    compulsory: true,
    networkId: String(boot.networkId),
    indexer,
    node,
    proofServer,
    compactContract: cfg.compactContract,
    compactArtifacts: {
      ok: artifactsOk,
      detail: artifactsOk
        ? `compactc managed artifacts ready (${listCircuitArtifacts().join(", ")})`
        : "missing — npm run compact:compile",
    },
    packages: boot.packages,
  };
}

async function probeUrl(url: string, label: string): Promise<{ ok: boolean; detail: string }> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    const text = await res.text().catch(() => "");
    return {
      ok: res.ok,
      detail: res.ok ? `${label} ready` : `${label} HTTP ${res.status} ${text.slice(0, 60)}`,
    };
  } catch (e) {
    return {
      ok: false,
      detail:
        label === "proof-server"
          ? "Offline — docker run -p 6300:6300 midnightntwrk/proof-server:8.0.3 -- midnight-proof-server -v"
          : e instanceof Error
            ? e.message
            : "unreachable",
    };
  }
}

async function probeRpc(url: string): Promise<{ ok: boolean; detail: string }> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "system_health", params: [] }),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    return {
      ok: res.ok,
      detail: res.ok ? "rpc.preprod.midnight.network reachable" : `node HTTP ${res.status}`,
    };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : "node unreachable" };
  }
}

export function midnightSettlementMeta(extra: Record<string, unknown> = {}) {
  const cfg = requireMidnight();
  return {
    foundation: "Midnight Network",
    networkId: getNetworkId(),
    indexer: cfg.indexer,
    node: cfg.node,
    compact: cfg.compactContract,
    docs: cfg.docs,
    ...extra,
  };
}
