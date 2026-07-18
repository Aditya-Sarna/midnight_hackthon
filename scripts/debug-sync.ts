import { WebSocket } from "ws";
(globalThis as unknown as { WebSocket: typeof WebSocket }).WebSocket = WebSocket;

import { Buffer } from "buffer";
import { readFileSync } from "node:fs";
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
  MidnightBech32m,
} from "@midnightntwrk/wallet-sdk";
import * as ledger from "@midnight-ntwrk/ledger-v8";
import { setNetworkId, getNetworkId } from "@midnight-ntwrk/midnight-js-network-id";

const seed = readFileSync("data/wallet-seed.local", "utf8").trim();
setNetworkId("preprod");
const hd = HDWallet.fromSeed(Buffer.from(seed, "hex"));
if (hd.type !== "seedOk") throw new Error("bad seed");
const derived = hd.hdWallet
  .selectAccount(0)
  .selectRoles([Roles.Zswap, Roles.NightExternal, Roles.Dust])
  .deriveKeysAt(0);
if (derived.type !== "keysDerived") throw new Error("derive fail");
const keys = derived.keys;
hd.hdWallet.clear();

const shieldedSecretKeys = ledger.ZswapSecretKeys.fromSeed(keys[Roles.Zswap]);
const dustSecretKey = ledger.DustSecretKey.fromSeed(keys[Roles.Dust]);
const unshieldedKeystore = createKeystore(keys[Roles.NightExternal], getNetworkId());

const base = {
  networkId: getNetworkId(),
  indexerClientConnection: {
    indexerHttpUrl: "https://indexer.preprod.midnight.network/api/v4/graphql",
    indexerWsUrl: "wss://indexer.preprod.midnight.network/api/v4/graphql/ws",
  },
  provingServerUrl: new URL("http://127.0.0.1:6300"),
  relayURL: new URL("wss://rpc.preprod.midnight.network"),
};

const wallet = await WalletFacade.init({
  configuration: {
    ...base,
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
console.log("started");

let n = 0;
const sub = wallet.state().subscribe((s) => {
  n += 1;
  if (n <= 8 || n % 15 === 0) {
    console.log("emit", n, {
      synced: s.isSynced,
      topKeys: Object.keys(s),
      uKeys: s.unshielded ? Object.keys(s.unshielded) : [],
      addr: s.unshielded?.address,
      progress: (s.unshielded as { progress?: unknown })?.progress,
    });
  }
});

try {
  const s = await Promise.race([
    wallet.waitForSyncedState(),
    new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout 120s")), 120_000)),
  ]);
  console.log("SYNCED balances", s.unshielded.balances);
  try {
    console.log(
      "bech32",
      MidnightBech32m.encode(getNetworkId(), s.unshielded.address).asString()
    );
  } catch (e) {
    console.error("encode fail", e);
    // fallback: keystore
    console.log("keystore pubkey", unshieldedKeystore.getPublicKey?.());
  }
} catch (e) {
  console.error("sync fail", e);
}

sub.unsubscribe();
await wallet.stop();
