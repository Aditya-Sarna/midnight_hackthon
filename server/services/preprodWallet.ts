/**
 * Per-settlement Preprod submit — each settle lands a unique network txId.
 * Prefer contract call (publish_settlement_anchor); else unshielded self-transfer.
 * Never fabricates channel-aliased txIds (`deployTx:settle:…`).
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import * as Rx from "rxjs";
import * as ledger from "@midnight-ntwrk/ledger-v8";
import { CompiledContract } from "@midnight-ntwrk/compact-js";
import { findDeployedContract } from "@midnight-ntwrk/midnight-js-contracts";
import {
  buildPreprodWallet,
  createPreprodProviders,
  loadDeploymentFile,
  nightBalance,
  PREPROD,
  readWalletSeed,
  ZK_PATH,
  type PreprodWalletCtx,
} from "./preprodRuntime.js";

export type SettlementSubmitResult =
  | { ok: true; txId: string; kind: "contract-call" | "unshielded-transfer" }
  | { ok: false; reason: "unfunded" | "unavailable"; detail: string };

type SubmitFn = (input: {
  settlementId: string;
  circuit: string;
  snarkDigests?: Record<string, string>;
}) => Promise<SettlementSubmitResult>;

/** Test seam — inject a submitter without hitting Preprod */
let injectedSubmitter: SubmitFn | null = null;

export function setSettlementSubmitter(fn: SubmitFn | null) {
  injectedSubmitter = fn;
}

function hexToBytes32(hex: string): Uint8Array {
  const clean = hex.replace(/^0x/, "").toLowerCase().padStart(64, "0").slice(0, 64);
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

async function proofServerHealthy(): Promise<boolean> {
  try {
    const res = await fetch(`${PREPROD.proofServer}/health`, {
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function finalizeAndSubmit(
  walletCtx: PreprodWalletCtx,
  recipe: unknown
): Promise<string> {
  const signed = await walletCtx.wallet.signRecipe(recipe as never, (payload) =>
    walletCtx.unshieldedKeystore.signData(payload)
  );
  const finalized = await walletCtx.wallet.finalizeRecipe(signed);
  return String(await walletCtx.wallet.submitTransaction(finalized));
}

async function submitContractAnchor(
  walletCtx: PreprodWalletCtx,
  settlementId: string,
  contractAddress: string
): Promise<string> {
  const contractMod = await import(pathToFileURL(join(ZK_PATH, "contract/index.js")).href);
  const compiledContract = CompiledContract.make("circled", contractMod.Contract).pipe(
    CompiledContract.withVacantWitnesses,
    CompiledContract.withCompiledFileAssets(ZK_PATH)
  );
  const providers = await createPreprodProviders(walletCtx);
  const found = await findDeployedContract(providers as never, {
    compiledContract,
    contractAddress: contractAddress as never,
    privateStateId: "circledState",
    initialPrivateState: {},
  });
  const call = found.callTx as {
    publish_settlement_anchor: (opts: {
      args: [Uint8Array];
    }) => Promise<{ public: { txId?: string }; txId?: string }>;
  };
  if (typeof call.publish_settlement_anchor !== "function") {
    throw new Error("publish_settlement_anchor circuit missing — run npm run compact:compile");
  }
  const result = await call.publish_settlement_anchor({
    args: [hexToBytes32(settlementId)],
  });
  const txId = result.public?.txId || result.txId;
  if (!txId) throw new Error("Contract call returned no txId");
  return String(txId);
}

async function submitUnshieldedSelfTransfer(
  walletCtx: PreprodWalletCtx,
  settlementId: string
): Promise<string> {
  const state = await Rx.firstValueFrom(
    walletCtx.wallet.state().pipe(
      Rx.filter((s) => nightBalance(s) > 0n),
      Rx.take(1),
      Rx.timeout({ first: 60_000 })
    )
  );
  if (nightBalance(state) <= 0n) {
    throw new Error("unfunded");
  }
  // Unique amount fingerprint (1..999) keeps each settle a distinct UTXO move
  const fingerprint = (BigInt("0x" + settlementId.slice(0, 8)) % 999n) + 1n;
  const recipe = await walletCtx.wallet.transferTransaction(
    [
      {
        type: "unshielded",
        outputs: [
          {
            type: ledger.unshieldedToken().raw,
            receiverAddress: state.unshielded.address,
            amount: fingerprint,
          },
        ],
      },
    ],
    {
      shieldedSecretKeys: walletCtx.shieldedSecretKeys,
      dustSecretKey: walletCtx.dustSecretKey,
    },
    { ttl: new Date(Date.now() + 30 * 60 * 1000), payFees: true }
  );
  return finalizeAndSubmit(walletCtx, recipe);
}

async function liveSubmit(input: {
  settlementId: string;
  circuit: string;
  snarkDigests?: Record<string, string>;
}): Promise<SettlementSubmitResult> {
  const seed = readWalletSeed();
  if (!seed) {
    return { ok: false, reason: "unfunded", detail: "No wallet seed configured" };
  }
  if (!(await proofServerHealthy())) {
    return {
      ok: false,
      reason: "unavailable",
      detail: "Proof-server offline — cannot submit Preprod tx",
    };
  }

  let walletCtx: PreprodWalletCtx | null = null;
  try {
    walletCtx = await buildPreprodWallet(seed);
    const deployment = loadDeploymentFile();
    const contractAddress =
      process.env.MIDNIGHT_CONTRACT_ADDRESS?.trim() ||
      (deployment.contractAddress as string | undefined);

    if (contractAddress && existsSync(join(ZK_PATH, "contract/index.js"))) {
      try {
        const txId = await submitContractAnchor(walletCtx, input.settlementId, contractAddress);
        return { ok: true, txId, kind: "contract-call" };
      } catch (e) {
        // Fall through to unshielded transfer if contract call not yet deployable
        console.warn(
          "[preprod] contract settle failed, trying unshielded transfer:",
          e instanceof Error ? e.message : e
        );
      }
    }

    const txId = await submitUnshieldedSelfTransfer(walletCtx, input.settlementId);
    return { ok: true, txId, kind: "unshielded-transfer" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/unfunded|timeout|0n/i.test(msg)) {
      return {
        ok: false,
        reason: "unfunded",
        detail: "Wallet unfunded — fund faucet and run npm run midnight:deploy",
      };
    }
    return { ok: false, reason: "unavailable", detail: msg };
  } finally {
    if (walletCtx) {
      try {
        await walletCtx.wallet.stop();
      } catch {
        /* ignore */
      }
    }
  }
}

export async function submitSettlementAttestation(input: {
  settlementId: string;
  circuit: string;
  snarkDigests?: Record<string, string>;
}): Promise<SettlementSubmitResult> {
  if (injectedSubmitter) return injectedSubmitter(input);
  if (process.env.NYXPAY_PREPROD_LIVE_SUBMIT === "0") {
    return {
      ok: false,
      reason: "unavailable",
      detail: "NYXPAY_PREPROD_LIVE_SUBMIT=0 — live Preprod submit disabled",
    };
  }
  return liveSubmit(input);
}
