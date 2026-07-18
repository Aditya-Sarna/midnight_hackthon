import { WebSocket } from "ws";
(globalThis as unknown as { WebSocket: typeof WebSocket }).WebSocket = WebSocket;

import { Buffer } from "buffer";
import { writeFileSync, existsSync, renameSync, mkdirSync } from "node:fs";
import {
  HDWallet,
  Roles,
  generateRandomSeed,
  WalletFacade,
  ShieldedWallet,
  DustWallet,
  UnshieldedWallet,
  createKeystore,
  PublicKey,
  NoOpTransactionHistoryStorage,
  MidnightBech32m,
} from "@midnightntwrk/wallet-sdk";
import { toHex } from "@midnight-ntwrk/midnight-js-utils";
import * as ledger from "@midnight-ntwrk/ledger-v8";
import { setNetworkId, getNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import * as Rx from "rxjs";

setNetworkId("preprod");
mkdirSync("data", { recursive: true });
if (existsSync("data/wallet-seed.local")) {
  renameSync("data/wallet-seed.local", `data/wallet-seed.old-${Date.now()}.local`);
}
const seed = toHex(Buffer.from(generateRandomSeed()));
writeFileSync("data/wallet-seed.local", seed + "\n", { mode: 0o600 });

const hd = HDWallet.fromSeed(Buffer.from(seed, "hex"));
if (hd.type !== "seedOk") throw new Error("bad seed");
const all = hd.hdWallet
  .selectAccount(0)
  .selectRoles([Roles.Zswap, Roles.NightExternal, Roles.Dust])
  .deriveKeysAt(0);
if (all.type !== "keysDerived") throw new Error("derive");
const shieldedSecretKeys = ledger.ZswapSecretKeys.fromSeed(all.keys[Roles.Zswap]);
const dustSecretKey = ledger.DustSecretKey.fromSeed(all.keys[Roles.Dust]);
const unshieldedKeystore = createKeystore(all.keys[Roles.NightExternal], getNetworkId());
hd.hdWallet.clear();

const base = {
  networkId: getNetworkId(),
  indexerClientConnection: {
    indexerHttpUrl: "https://indexer.preprod.midnight.network/api/v4/graphql",
    indexerWsUrl: "wss://indexer.preprod.midnight.network/api/v4/graphql/ws",
  },
  provingServerUrl: new URL(process.env.MIDNIGHT_PROOF_SERVER_URL || "http://127.0.0.1:6300"),
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
const s = await Rx.firstValueFrom(wallet.state());
const addr = MidnightBech32m.encode(getNetworkId(), s.unshielded.address).asString();
writeFileSync(
  "data/FAUCET_INSTRUCTIONS.txt",
  `NEW wallet (previous address hit 24h faucet cooldown)\n\nFund THIS address:\n${addr}\n\nhttps://faucet.preprod.midnight.network/\n\nThen run: npm run midnight:deploy\n`
);
console.log(addr);
await wallet.stop();
