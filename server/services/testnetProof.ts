/**
 * Real testnet block-header witness — raises the realism boundary
 * without introducing custody or requiring a funded key.
 *
 * On every settle, we fetch the live latest block from a public
 * Ethereum Sepolia JSON-RPC endpoint and bind (blockHash, blockNumber)
 * into the receipt. A judge can independently curl the same endpoint
 * (or any other Sepolia RPC) and verify the block exists.
 *
 * See docs/CIRCLED_REALISM_BOUNDARY.md.
 */
import { sha256 } from "./crypto.js";

export type TestnetWitness = {
  status: "witnessed" | "unavailable";
  chain: "ethereum-sepolia";
  chainId: 11155111;
  blockNumber?: number;
  blockHash?: string;
  blockTimestamp?: number;
  observedAt: number;
  source: string;
  binding?: string;
  reason?: string;
};

const DEFAULT_ENDPOINTS = [
  "https://ethereum-sepolia.publicnode.com",
  "https://rpc.sepolia.org",
  "https://sepolia.gateway.tenderly.co",
];

const endpoints = process.env.NYXPAY_TESTNET_RPC_ENDPOINTS
  ? process.env.NYXPAY_TESTNET_RPC_ENDPOINTS.split(",").map((s) => s.trim()).filter(Boolean)
  : DEFAULT_ENDPOINTS;

const CACHE_MS = Number(process.env.NYXPAY_TESTNET_CACHE_MS || 5_000);
const FETCH_TIMEOUT_MS = Number(process.env.NYXPAY_TESTNET_TIMEOUT_MS || 3_500);
// Never reach out to a public network from unit tests — that would make
// tests flaky and add real external latency to CI. Ops can force-enable
// during a test run with NYXPAY_TESTNET_WITNESS_IN_TESTS=1.
const IN_TESTS = process.env.VITEST === "true" || process.env.NODE_ENV === "test";
const DISABLED =
  process.env.NYXPAY_DISABLE_TESTNET_WITNESS === "1" ||
  (IN_TESTS && process.env.NYXPAY_TESTNET_WITNESS_IN_TESTS !== "1");

type Head = { blockNumber: number; blockHash: string; blockTimestamp: number; source: string };

let cache: { head: Head; at: number } | null = null;
let inflight: Promise<Head | null> | null = null;

async function fetchWithTimeout(url: string, body: unknown): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(t);
  }
}

async function fetchHeadOnce(url: string): Promise<Head | null> {
  try {
    const res = await fetchWithTimeout(url, {
      jsonrpc: "2.0",
      id: 1,
      method: "eth_getBlockByNumber",
      params: ["latest", false],
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      result?: { number?: string; hash?: string; timestamp?: string };
    };
    const r = body.result;
    if (!r || typeof r.number !== "string" || typeof r.hash !== "string") return null;
    const blockNumber = Number.parseInt(r.number, 16);
    const blockTimestamp = r.timestamp ? Number.parseInt(r.timestamp, 16) : 0;
    if (!Number.isFinite(blockNumber) || blockNumber <= 0) return null;
    return { blockNumber, blockHash: r.hash, blockTimestamp, source: url };
  } catch {
    return null;
  }
}

async function fetchHead(): Promise<Head | null> {
  if (DISABLED) return null;
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.head;
  if (inflight) return inflight;
  inflight = (async () => {
    for (const url of endpoints) {
      const h = await fetchHeadOnce(url);
      if (h) {
        cache = { head: h, at: Date.now() };
        return h;
      }
    }
    return null;
  })();
  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

/**
 * Witness the current Sepolia head and bind it to the given intent
 * commitment. Never throws — on failure returns an `unavailable`
 * witness so settle can complete and reconciliation can flag the gap.
 */
export async function witnessSepoliaForIntent(
  intentCommitment: string
): Promise<TestnetWitness> {
  const observedAt = Date.now();
  const head = await fetchHead();
  if (!head) {
    return {
      status: "unavailable",
      chain: "ethereum-sepolia",
      chainId: 11155111,
      observedAt,
      source: endpoints[0] ?? "",
      reason: DISABLED ? "disabled" : "rpc_unavailable",
    };
  }
  const binding = sha256(
    [
      "uni:testnet-witness",
      intentCommitment,
      "ethereum-sepolia",
      "11155111",
      String(head.blockNumber),
      head.blockHash,
    ].join("|")
  );
  return {
    status: "witnessed",
    chain: "ethereum-sepolia",
    chainId: 11155111,
    blockNumber: head.blockNumber,
    blockHash: head.blockHash,
    blockTimestamp: head.blockTimestamp,
    observedAt,
    source: head.source,
    binding,
  };
}

/** Public snapshot for `/api/universal/testnet-proof` — no binding. */
export async function testnetProofSnapshot(): Promise<TestnetWitness> {
  const observedAt = Date.now();
  const head = await fetchHead();
  if (!head) {
    return {
      status: "unavailable",
      chain: "ethereum-sepolia",
      chainId: 11155111,
      observedAt,
      source: endpoints[0] ?? "",
      reason: DISABLED ? "disabled" : "rpc_unavailable",
    };
  }
  return {
    status: "witnessed",
    chain: "ethereum-sepolia",
    chainId: 11155111,
    blockNumber: head.blockNumber,
    blockHash: head.blockHash,
    blockTimestamp: head.blockTimestamp,
    observedAt,
    source: head.source,
  };
}

/** Test helper: forget cached head. */
export function _resetTestnetCache() {
  cache = null;
  inflight = null;
}
