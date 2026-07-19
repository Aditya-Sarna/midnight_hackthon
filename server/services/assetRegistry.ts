export type SettlementType = "internal" | "fiat_rail" | "stablecoin" | "network_fee";

export type AssetDefinition = {
  code: string;
  symbol: string;
  name: string;
  decimals: number;
  network: string;
  settlementType: SettlementType;
  countries: string[];
  privatelyCommittable: boolean;
  note: string;
};

const ASSETS: AssetDefinition[] = [
  {
    code: "CIRCLE_UNIT",
    symbol: "CIRCLE",
    name: "Circle product unit",
    decimals: 2,
    network: "internal_ledger",
    settlementType: "internal",
    countries: ["pilot"],
    privatelyCommittable: true,
    note: "Class 0 product balance; Compact commitments on Midnight; not legal tender.",
  },
  {
    code: "INR",
    symbol: "₹",
    name: "Indian rupee",
    decimals: 2,
    network: "licensed_fiat_rail",
    settlementType: "fiat_rail",
    countries: ["IN"],
    privatelyCommittable: true,
    note: "Rupee intent can be privately proven; real settlement requires UPI/bank/PSP rail.",
  },
  {
    code: "USD",
    symbol: "$",
    name: "US dollar",
    decimals: 2,
    network: "licensed_fiat_rail",
    settlementType: "fiat_rail",
    countries: ["US", "pilot"],
    privatelyCommittable: true,
    note: "Fiat intent can be proven; movement requires a licensed provider rail.",
  },
  {
    code: "USDC",
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    network: "mock_usdc",
    settlementType: "stablecoin",
    countries: ["pilot"],
    privatelyCommittable: true,
    note: "Stablecoin adapter target for demo routes; production needs issuer/provider integration.",
  },
  {
    code: "BTC",
    symbol: "BTC",
    name: "Bitcoin",
    decimals: 8,
    network: "bitcoin_sandbox",
    settlementType: "stablecoin",
    countries: ["pilot"],
    privatelyCommittable: true,
    note: "Sandbox BTC credit only; not mainnet custody. Production needs licensed VASP/wallet screening.",
  },
  {
    code: "tDUST",
    symbol: "tDUST",
    name: "Midnight Preprod network fee",
    decimals: 6,
    network: "midnight_preprod",
    settlementType: "network_fee",
    countries: ["preprod"],
    privatelyCommittable: false,
    note: "Network fee asset only; not the user payment asset.",
  },
];

export function listAssets(): AssetDefinition[] {
  return ASSETS;
}

export function getAsset(code: string): AssetDefinition | undefined {
  return ASSETS.find((asset) => asset.code === code.toUpperCase());
}

export function assetRegistryDocument() {
  return {
    ok: true,
    claim:
      "Assets are normalized for routing; Midnight proves private authorization/state, while configured rails settle real-world value.",
    assets: listAssets(),
  };
}