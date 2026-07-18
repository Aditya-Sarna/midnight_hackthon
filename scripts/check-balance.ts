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
import * as Rx from "rxjs";

setNetworkId("preprod");
const seed = readFileSync("data/wallet-seed.local", "utf8").trim();
const hd = HDWallet.fromSeed(Buffer.from(seed, "hex"));
if (hd.type !== "seedOk") throw new Error("bad seed");
const derived = hd.hdWallet
  .selectAccount(0)
  .selectRoles([Roles.Zswap, Roles.NightExternal, Roles.Dust])
  .deriveKeysAt(0);
if (derived.type !== "keysDerived") throw new Error("derive");
const keys = derived.keys;
hd.hdWallet.clear();

const sk = ledger.ZswapSecretKeys.fromSeed(keys[Roles.Zswap]);
const dust = ledger.DustSecretKey.fromSeed(keys[Roles.Dust]);
const ks = createKeystore(keys[Roles.NightExternal], getNetworkId());
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
  shielded: (cfg) => ShieldedWallet(cfg).startWithSecretKeys(sk),
  unshielded: (cfg) => UnshieldedWallet(cfg).startWithPublicKey(PublicKey.fromKeyStore(ks)),
  dust: (cfg) =>
    DustWallet(cfg).startWithSecretKey(dust, ledger.LedgerParameters.initialParameters().dust),
});
await wallet.start(sk, dust);

const first = await Rx.firstValueFrom(wallet.state());
const addr = MidnightBech32m.encode(getNetworkId(), first.unshielded.address).asString();
console.log("addr", addr);

const deadline = Date.now() + 90_000;
let last = 0n;
while (Date.now() < deadline) {
  const s = await Rx.firstValueFrom(wallet.state());
  const bal = s.unshielded.balances[ledger.unshieldedToken().raw] ?? 0n;
  const coins = s.unshielded.availableCoins?.length ?? 0;
  if (bal !== last) {
    console.log("bal", bal.toString(), "coins", coins);
    last = bal;
  } else {
    console.log("poll bal", bal.toString(), "coins", coins);
  }
  if (bal > 0n) break;
  await new Promise((r) => setTimeout(r, 4000));
}

await wallet.stop();
if (last === 0n) {
  console.log("RESULT: empty — faucet cooldown means prior request was for this address; funds may still be indexing, or captcha failed after rate-limit stamp");
  process.exit(2);
}
console.log("RESULT: funded", last.toString());
process.exit(0);
