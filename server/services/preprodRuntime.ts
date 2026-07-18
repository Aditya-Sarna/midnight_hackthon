/**
 * Shared Preprod wallet + provider bootstrap for deploy and per-settlement submit.
 */
import { WebSocket } from "ws";
(globalThis as unknown as { WebSocket: typeof WebSocket }).WebSocket = WebSocket;

import { Buffer } from "buffer";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as Rx from "rxjs";
import {
  HDWallet,
  Roles,
  WalletFacade,
  ShieldedWallet,
  DustWallet,
  UnshieldedWallet,
  createKeystore,
  PublicKey,
  NoOpTransactionHistoryStorage,
} from "@midnightntwrk/wallet-sdk";
import * as ledger from "@midnight-ntwrk/ledger-v8";
import { setNetworkId, getNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { httpClientProofProvider } from "@midnight-ntwrk/midnight-js-http-client-proof-provider";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { levelPrivateStateProvider } from "@midnight-ntwrk/midnight-js-level-private-state-provider";
import { NodeZkConfigProvider } from "@midnight-ntwrk/midnight-js-node-zk-config-provider";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "../..");
export const ZK_PATH = join(ROOT, "contracts/managed/nyxpay");
export const SEED_PATH = join(ROOT, "data/wallet-seed.local");
export const DEPLOY_PATH = join(ROOT, "data/onchain-deployment.json");

export const PREPROD = {
  networkId: "preprod" as const,
  indexerHttpUrl: "https://indexer.preprod.midnight.network/api/v4/graphql",
  indexerWsUrl: "wss://indexer.preprod.midnight.network/api/v4/graphql/ws",
  node: "https://rpc.preprod.midnight.network",
  proofServer: process.env.MIDNIGHT_PROOF_SERVER_URL || "http://127.0.0.1:6300",
};

export function readWalletSeed(): string | null {
  const env = process.env.MIDNIGHT_WALLET_SEED?.trim();
  if (env) return env;
  if (existsSync(SEED_PATH)) {
    const s = readFileSync(SEED_PATH, "utf8").trim();
    if (s) return s;
  }
  return null;
}

export function loadDeploymentFile(): Record<string, unknown> {
  if (!existsSync(DEPLOY_PATH)) return {};
  try {
    return JSON.parse(readFileSync(DEPLOY_PATH, "utf8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function deriveKeys(seedHex: string) {
  const hd = HDWallet.fromSeed(Buffer.from(seedHex, "hex"));
  if (hd.type !== "seedOk") throw new Error("Invalid seed");
  const result = hd.hdWallet
    .selectAccount(0)
    .selectRoles([Roles.Zswap, Roles.NightExternal, Roles.Dust])
    .deriveKeysAt(0);
  if (result.type !== "keysDerived") throw new Error("Key derivation failed");
  hd.hdWallet.clear();
  return result.keys;
}

export async function buildPreprodWallet(seedHex: string) {
  setNetworkId(PREPROD.networkId);
  const keys = deriveKeys(seedHex);
  const shieldedSecretKeys = ledger.ZswapSecretKeys.fromSeed(keys[Roles.Zswap]);
  const dustSecretKey = ledger.DustSecretKey.fromSeed(keys[Roles.Dust]);
  const unshieldedKeystore = createKeystore(keys[Roles.NightExternal], getNetworkId());

  const shieldedConfig = {
    networkId: getNetworkId(),
    indexerClientConnection: {
      indexerHttpUrl: PREPROD.indexerHttpUrl,
      indexerWsUrl: PREPROD.indexerWsUrl,
    },
    provingServerUrl: new URL(PREPROD.proofServer),
    relayURL: new URL(PREPROD.node.replace(/^http/, "ws")),
  };

  const wallet = await WalletFacade.init({
    configuration: {
      ...shieldedConfig,
      txHistoryStorage: new NoOpTransactionHistoryStorage(),
      costParameters: {
        additionalFeeOverhead: 300_000_000_000_000n,
        feeBlocksMargin: 5,
      },
    },
    shielded: (cfg) => ShieldedWallet(cfg).startWithSecretKeys(shieldedSecretKeys),
    unshielded: (cfg) =>
      UnshieldedWallet(cfg).startWithPublicKey(PublicKey.fromKeyStore(unshieldedKeystore)),
    dust: (cfg) =>
      DustWallet(cfg).startWithSecretKey(
        dustSecretKey,
        ledger.LedgerParameters.initialParameters().dust
      ),
  });
  await wallet.start(shieldedSecretKeys, dustSecretKey);
  return { wallet, shieldedSecretKeys, dustSecretKey, unshieldedKeystore };
}

export type PreprodWalletCtx = Awaited<ReturnType<typeof buildPreprodWallet>>;

export async function createPreprodProviders(walletCtx: PreprodWalletCtx) {
  const state = await Rx.firstValueFrom(walletCtx.wallet.state().pipe(Rx.take(1)));
  const cpkRaw = state.shielded.coinPublicKey as string | { toHexString?: () => string };
  const epkRaw = state.shielded.encryptionPublicKey as string | { toHexString?: () => string };
  const cpk = typeof cpkRaw === "string" ? cpkRaw : cpkRaw.toHexString?.() ?? String(cpkRaw);
  const epk = typeof epkRaw === "string" ? epkRaw : epkRaw.toHexString?.() ?? String(epkRaw);

  const walletProvider = {
    getCoinPublicKey: () => cpk,
    getEncryptionPublicKey: () => epk,
    async balanceTx(tx: unknown, ttl?: Date) {
      const recipe = await walletCtx.wallet.balanceUnboundTransaction(
        tx as never,
        {
          shieldedSecretKeys: walletCtx.shieldedSecretKeys,
          dustSecretKey: walletCtx.dustSecretKey,
        },
        { ttl: ttl ?? new Date(Date.now() + 30 * 60 * 1000) }
      );
      const signed = await walletCtx.wallet.signRecipe(recipe, (payload) =>
        walletCtx.unshieldedKeystore.signData(payload)
      );
      return walletCtx.wallet.finalizeRecipe(signed);
    },
    submitTx: (tx: unknown) => walletCtx.wallet.submitTransaction(tx as never),
  };

  const zkConfigProvider = new NodeZkConfigProvider(ZK_PATH);
  return {
    privateStateProvider: levelPrivateStateProvider({
      privateStateStoreName: "circled-private-state",
      walletProvider,
    }),
    publicDataProvider: indexerPublicDataProvider(PREPROD.indexerHttpUrl, PREPROD.indexerWsUrl),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(PREPROD.proofServer, zkConfigProvider),
    walletProvider,
    midnightProvider: walletProvider,
  };
}

export function nightBalance(state: {
  unshielded: { balances: Record<string, bigint> };
}): bigint {
  return state.unshielded.balances[ledger.unshieldedToken().raw] ?? 0n;
}
