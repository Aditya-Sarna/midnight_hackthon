/**
 * Real Preprod broadcast — unique network txId per settlement.
 * Channel-anchored fallback only when NYXPAY_ALLOW_ANCHOR_FALLBACK=1 (never under requireOnchain).
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomBytes } from "node:crypto";
import { loadConfig } from "../config.js";
import { requireMidnight } from "./midnight.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEPLOY_PATH = join(__dirname, "../../data/onchain-deployment.json");
const SEED_PATH = join(__dirname, "../../data/wallet-seed.local");

export type BroadcastResult = {
  status: "submitted" | "skipped" | "failed" | "requires_funding";
  network: string;
  txId?: string;
  kind?: "contract-call" | "unshielded-transfer" | "anchor-fallback";
  detail: string;
};

function loadDeployment(): Record<string, unknown> {
  if (!existsSync(DEPLOY_PATH)) return {};
  try {
    return JSON.parse(readFileSync(DEPLOY_PATH, "utf8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function saveDeployment(patch: Record<string, unknown>) {
  mkdirSync(dirname(DEPLOY_PATH), { recursive: true });
  const prev = loadDeployment();
  writeFileSync(DEPLOY_PATH, JSON.stringify({ ...prev, ...patch }, null, 2));
}

function walletConfigured(): boolean {
  return Boolean(
    process.env.MIDNIGHT_WALLET_SEED?.trim() ||
      (existsSync(SEED_PATH) && readFileSync(SEED_PATH, "utf8").trim())
  );
}

export async function broadcastSettlement(input: {
  circuit: string;
  snarkDigests?: Record<string, string>;
  compactLedger?: Record<string, string | undefined>;
}): Promise<BroadcastResult> {
  const cfg = loadConfig();
  const midnight = requireMidnight();
  const requireOnchain =
    Boolean(process.env.NYXPAY_REQUIRE_ONCHAIN === "1") ||
    (cfg.isStrict && process.env.NYXPAY_REQUIRE_ONCHAIN !== "0");
  const allowAnchor =
    process.env.NYXPAY_ALLOW_ANCHOR_FALLBACK === "1" && !requireOnchain;

  if (!walletConfigured()) {
    if (requireOnchain) {
      return {
        status: "failed",
        network: midnight.networkId,
        detail:
          "NYXPAY_REQUIRE_ONCHAIN: set MIDNIGHT_WALLET_SEED and fund via faucet, then npm run midnight:deploy",
      };
    }
    return {
      status: "skipped",
      network: midnight.networkId,
      detail: "Wallet not configured — local Compact ledger only",
    };
  }

  const settlementId = createHash("sha256")
    .update(
      JSON.stringify({
        circuit: input.circuit,
        snarks: input.snarkDigests ?? {},
        ledger: input.compactLedger ?? {},
        nonce: randomBytes(8).toString("hex"),
        at: Date.now(),
      })
    )
    .digest("hex");

  try {
    const { submitSettlementAttestation } = await import("./preprodWallet.js");
    const submitted = await submitSettlementAttestation({
      settlementId,
      circuit: input.circuit,
      snarkDigests: input.snarkDigests,
    });
    if (submitted.ok) {
      saveDeployment({
        lastSettlementTxId: submitted.txId,
        lastSettlementId: settlementId,
        lastSettlementKind: submitted.kind,
        lastSettlementAt: new Date().toISOString(),
        lastSettlementSnarks: input.snarkDigests ?? {},
      });
      return {
        status: "submitted",
        network: midnight.networkId,
        txId: submitted.txId,
        kind: submitted.kind,
        detail: `Preprod ${submitted.kind} submitted: ${submitted.txId}`,
      };
    }
    if (submitted.reason === "unfunded") {
      return {
        status: "requires_funding",
        network: midnight.networkId,
        detail: submitted.detail,
      };
    }
    if (requireOnchain) {
      return {
        status: "failed",
        network: midnight.networkId,
        detail: submitted.detail,
      };
    }
  } catch (e) {
    if (requireOnchain) {
      return {
        status: "failed",
        network: midnight.networkId,
        detail: e instanceof Error ? e.message : String(e),
      };
    }
  }

  if (allowAnchor) {
    const deployment = loadDeployment();
    const existingTx = (deployment.txId || deployment.lastTxId || deployment.faucetTxId) as
      | string
      | undefined;
    if (existingTx) {
      saveDeployment({
        lastSettlementId: settlementId,
        lastSettlementAnchorTxId: existingTx,
        lastSettlementAt: new Date().toISOString(),
      });
      return {
        status: "submitted",
        network: midnight.networkId,
        txId: existingTx,
        kind: "anchor-fallback",
        detail: `Dev anchor fallback to ${existingTx} (settlementId=${settlementId.slice(0, 16)}…)`,
      };
    }
  }

  if (requireOnchain) {
    return {
      status: "failed",
      network: midnight.networkId,
      detail: "Live Preprod submit required — fund wallet and ensure proof-server is up",
    };
  }

  return {
    status: "skipped",
    network: midnight.networkId,
    detail: "Preprod live submit unavailable — Compact ledger advanced locally",
  };
}
