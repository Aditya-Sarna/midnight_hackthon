/**
 * Stripe test-mode sandbox receiver accounts (Connect-style).
 * Not live Stripe charges — test account IDs for pilot demos.
 */
import { randomNonce, sha256 } from "./crypto.js";

export type SandboxAccount = {
  id: string;
  displayName: string;
  handle: string;
  preferredAsset: "USD" | "BTC" | "CIRCLE_UNIT";
  preferredMethod: "stripe_test" | "bitcoin_sandbox" | "internal_ledger";
  /** Stripe Connect / Customer test id (never a live secret key) */
  stripeAccountId: string;
  opaqueDestinationId: string;
  kycStatus: "sandbox_verified";
  sanctionsStatus: "clear";
  jurisdiction: string;
  badge: string;
  settlementHint: string;
};

const DEFAULTS: SandboxAccount[] = [
  {
    id: "acct_maya_usd",
    displayName: "Maya Chen",
    handle: "maya.usd",
    preferredAsset: "USD",
    preferredMethod: "stripe_test",
    stripeAccountId: "acct_1StripeTestMayaUSD",
    opaqueDestinationId: sha256("stripe:test:maya:usd:v1").slice(0, 40),
    kycStatus: "sandbox_verified",
    sanctionsStatus: "clear",
    jurisdiction: "US",
    badge: "USD",
    settlementHint: "Stripe test · Connect acct_1StripeTestMayaUSD · USD payout",
  },
  {
    id: "acct_arjun_btc",
    displayName: "Arjun Rao",
    handle: "arjun.btc",
    preferredAsset: "BTC",
    preferredMethod: "stripe_test",
    stripeAccountId: "acct_1StripeTestArjunBTC",
    opaqueDestinationId: sha256("stripe:test:arjun:btc:v1").slice(0, 40),
    kycStatus: "sandbox_verified",
    sanctionsStatus: "clear",
    jurisdiction: "IN",
    badge: "BTC",
    settlementHint: "Stripe test · Connect acct_1StripeTestArjunBTC · BTC sandbox credit",
  },
];

let accounts: SandboxAccount[] = [...DEFAULTS];

export function listSandboxAccounts(): SandboxAccount[] {
  return accounts;
}

export function getSandboxAccount(id: string): SandboxAccount | undefined {
  return accounts.find((a) => a.id === id);
}

export function createSandboxAccount(input: {
  displayName: string;
  preferredAsset: SandboxAccount["preferredAsset"];
  preferredMethod?: SandboxAccount["preferredMethod"];
  jurisdiction?: string;
}): SandboxAccount {
  const asset = input.preferredAsset;
  const method = input.preferredMethod ?? "stripe_test";
  const acct: SandboxAccount = {
    id: `acct_${randomNonce(6)}`,
    displayName: input.displayName.trim() || "Sandbox account",
    handle: `${input.displayName.toLowerCase().replace(/\s+/g, ".")}.test`,
    preferredAsset: asset,
    preferredMethod: method,
    stripeAccountId: `acct_1StripeTest${randomNonce(4)}`,
    opaqueDestinationId: sha256(`stripe:test:${randomNonce(8)}:${asset}`).slice(0, 40),
    kycStatus: "sandbox_verified",
    sanctionsStatus: "clear",
    jurisdiction: input.jurisdiction || "pilot",
    badge: asset === "CIRCLE_UNIT" ? "CIRCLE" : asset,
    settlementHint: `Stripe test · ${asset} destination`,
  };
  accounts.push(acct);
  return acct;
}

export function resetSandboxAccounts() {
  accounts = [...DEFAULTS];
}
