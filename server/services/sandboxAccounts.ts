/**
 * Stripe test-mode sandbox receiver accounts (Connect-style).
 * Opaque destination IDs only — never raw card/bank/wallet in logs.
 */
import { randomNonce, sha256 } from "./crypto.js";

export type KycStatus = "unverified" | "sandbox_verified" | "enhanced_verified";

export type SandboxAccount = {
  id: string;
  displayName: string;
  handle: string;
  preferredAsset: "USD" | "BTC" | "CIRCLE_UNIT";
  preferredMethod: "stripe_test" | "bitcoin_sandbox" | "internal_ledger";
  /** Stripe Connect / Customer test id (never a live secret key) */
  stripeAccountId: string;
  opaqueDestinationId: string;
  kycStatus: KycStatus;
  /** Required for INR → BTC enhanced path */
  walletScreened: boolean;
  sanctionsStatus: "clear" | "hit" | "stale";
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
    walletScreened: false,
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
    kycStatus: "enhanced_verified",
    walletScreened: true,
    sanctionsStatus: "clear",
    jurisdiction: "IN",
    badge: "BTC",
    settlementHint: "Stripe test · Connect acct_1StripeTestArjunBTC · BTC sandbox credit",
  },
];

let accounts: SandboxAccount[] = DEFAULTS.map((a) => ({ ...a }));
let onChange: (() => void) | null = null;

export function bindSandboxAccountsPersist(cb: () => void) {
  onChange = cb;
}

function notify() {
  onChange?.();
}

export function listSandboxAccounts(): SandboxAccount[] {
  return accounts;
}

export function getSandboxAccount(id: string): SandboxAccount | undefined {
  return accounts.find((a) => a.id === id);
}

export function hydrateSandboxAccounts(list: SandboxAccount[] | undefined) {
  if (list && list.length) {
    accounts = list.map((a) => ({
      ...a,
      walletScreened: Boolean(a.walletScreened),
      kycStatus: a.kycStatus || "unverified",
      sanctionsStatus: a.sanctionsStatus || "clear",
    }));
  } else {
    accounts = DEFAULTS.map((a) => ({ ...a }));
  }
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
    // New accounts start uncleared — hard compliance must verify before settle
    kycStatus: "unverified",
    walletScreened: false,
    sanctionsStatus: "clear",
    jurisdiction: input.jurisdiction || "pilot",
    badge: asset === "CIRCLE_UNIT" ? "CIRCLE" : asset,
    settlementHint: `Stripe test · ${asset} destination`,
  };
  accounts.push(acct);
  notify();
  return acct;
}

export function verifySandboxAccount(
  id: string,
  input: {
    level: "sandbox_verified" | "enhanced_verified";
    walletScreened?: boolean;
    sanctionsStatus?: SandboxAccount["sanctionsStatus"];
  }
): SandboxAccount {
  const acct = getSandboxAccount(id);
  if (!acct) throw new Error("sandbox account not found");
  acct.kycStatus = input.level;
  if (input.walletScreened != null) acct.walletScreened = input.walletScreened;
  if (input.level === "enhanced_verified" && input.walletScreened !== false) {
    acct.walletScreened = true;
  }
  if (input.sanctionsStatus) acct.sanctionsStatus = input.sanctionsStatus;
  notify();
  return acct;
}

/** Test helper: force KYC state (e.g. unverified Maya) */
export function setSandboxAccountKyc(
  id: string,
  patch: Partial<Pick<SandboxAccount, "kycStatus" | "walletScreened" | "sanctionsStatus">>
): SandboxAccount {
  const acct = getSandboxAccount(id);
  if (!acct) throw new Error("sandbox account not found");
  Object.assign(acct, patch);
  notify();
  return acct;
}

export function accountClearedForChallenge(acct: SandboxAccount): boolean {
  return (
    acct.sanctionsStatus === "clear" &&
    (acct.kycStatus === "sandbox_verified" || acct.kycStatus === "enhanced_verified")
  );
}

export function accountClearedForEnhanced(acct: SandboxAccount): boolean {
  return (
    acct.sanctionsStatus === "clear" &&
    acct.kycStatus === "enhanced_verified" &&
    acct.walletScreened === true
  );
}

export function resetSandboxAccounts() {
  accounts = DEFAULTS.map((a) => ({ ...a }));
  notify();
}
