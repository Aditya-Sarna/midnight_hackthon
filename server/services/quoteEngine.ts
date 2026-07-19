import { randomNonce } from "./crypto.js";
import { getAsset } from "./assetRegistry.js";
import { getPaymentMethod } from "./paymentMethodRegistry.js";

export type UniversalPaymentIntent = {
  senderId: string;
  recipientId: string;
  sourceAsset: string;
  sourceMethod: string;
  targetAsset: string;
  targetMethod: string;
  amount: string;
  routePreference?: "cheapest" | "fastest" | "most_private" | "recipient_preferred";
  privacyMode?: "private_amount" | "public_amount" | "selective_disclosure";
};

export type UniversalQuote = {
  quoteId: string;
  sourceAsset: string;
  targetAsset: string;
  sourceAmount: string;
  targetAmount: string;
  rate: string;
  feeAmount: string;
  expiresAt: number;
  complianceLevel: "low_value" | "kyc_required" | "enhanced_due_diligence";
  note: string;
};

const RATES: Record<string, number> = {
  "INR:INR": 1,
  "INR:CIRCLE_UNIT": 1,
  "CIRCLE_UNIT:INR": 1,
  "INR:USD": 0.012,
  "USD:INR": 83.3,
  "INR:USDC": 0.0116,
  "USDC:INR": 86.2,
  "INR:BTC": 0.00000014,
  "BTC:INR": 7_100_000,
  "USD:USDC": 1,
  "USDC:USD": 1,
  "USD:BTC": 0.0000115,
  "BTC:USD": 87_000,
  "CIRCLE_UNIT:USDC": 0.0116,
  "USDC:CIRCLE_UNIT": 86.2,
  "CIRCLE_UNIT:USD": 0.012,
  "USD:CIRCLE_UNIT": 83.3,
  "CIRCLE_UNIT:BTC": 0.00000014,
  "BTC:CIRCLE_UNIT": 7_100_000,
};

function parseAmount(value: string): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) throw new Error("amount must be > 0");
  return n;
}

export function quoteUniversalPayment(intent: UniversalPaymentIntent): UniversalQuote {
  const sourceAsset = getAsset(intent.sourceAsset);
  const targetAsset = getAsset(intent.targetAsset);
  const sourceMethod = getPaymentMethod(intent.sourceMethod);
  const targetMethod = getPaymentMethod(intent.targetMethod);
  if (!sourceAsset) throw new Error(`unsupported sourceAsset ${intent.sourceAsset}`);
  if (!targetAsset) throw new Error(`unsupported targetAsset ${intent.targetAsset}`);
  if (!sourceMethod) throw new Error(`unsupported sourceMethod ${intent.sourceMethod}`);
  if (!targetMethod) throw new Error(`unsupported targetMethod ${intent.targetMethod}`);
  if (!sourceMethod.supportedAssets.includes(sourceAsset.code)) {
    throw new Error(`${sourceMethod.id} cannot debit ${sourceAsset.code}`);
  }
  if (!targetMethod.supportedAssets.includes(targetAsset.code)) {
    throw new Error(`${targetMethod.id} cannot credit ${targetAsset.code}`);
  }

  const amount = parseAmount(intent.amount);
  const rate = RATES[`${sourceAsset.code}:${targetAsset.code}`];
  if (rate === undefined) {
    throw new Error(`no route quote for ${sourceAsset.code}->${targetAsset.code}`);
  }
  const feeRate = sourceMethod.readiness === "live_pilot" && targetMethod.readiness === "live_pilot" ? 0 : 0.006;
  const fee = Math.max(0.01, amount * feeRate);
  const targetAmount = amount * rate;
  const requiresKyc = sourceMethod.kycRequired || targetMethod.kycRequired;
  const fmt = (n: number, decimals: number) =>
    n.toFixed(decimals > 6 ? 8 : decimals > 2 ? 4 : 2);
  return {
    quoteId: `q_uni_${randomNonce(8)}`,
    sourceAsset: sourceAsset.code,
    targetAsset: targetAsset.code,
    sourceAmount: fmt(amount, sourceAsset.decimals),
    targetAmount: fmt(targetAmount, targetAsset.decimals),
    rate: String(rate),
    feeAmount: fmt(fee, sourceAsset.decimals),
    expiresAt: Date.now() + 120_000,
    complianceLevel: requiresKyc ? "kyc_required" : "low_value",
    note: "Deterministic pilot quote; production routes must use provider quotes/FX.",
  };
}