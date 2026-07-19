import { randomNonce } from "./crypto.js";
import { quoteUniversalPayment, type UniversalPaymentIntent, type UniversalQuote } from "./quoteEngine.js";

export type RoutePlan = {
  routeId: string;
  quote: UniversalQuote;
  sourceAdapter: string;
  conversionAdapter?: string;
  targetAdapter: string;
  preference: string;
  estimatedSettlementTimeMs: number;
  complianceLevel: UniversalQuote["complianceLevel"];
  mock: boolean;
  note: string;
};

function adapterForMethod(method: string): string {
  if (method === "stablecoin_wallet") return "mock_usdc";
  if (method === "upi") return "mock_upi";
  if (method === "card") return "mock_card";
  if (method === "bank_sandbox") return "bank_sandbox";
  if (method === "bitcoin_sandbox") return "bitcoin_sandbox";
  if (method === "stripe_test") return "stripe_test";
  if (method === "internal_ledger") return "internal_ledger";
  return method;
}

export function planUniversalRoute(
  intent: UniversalPaymentIntent,
  existingQuote?: UniversalQuote
): RoutePlan {
  const quote = existingQuote ?? quoteUniversalPayment(intent);
  const sourceAdapter = adapterForMethod(intent.sourceMethod);
  const targetAdapter = adapterForMethod(intent.targetMethod);
  const conversionNeeded = quote.sourceAsset !== quote.targetAsset;
  return {
    routeId: `route_${randomNonce(8)}`,
    quote,
    sourceAdapter,
    conversionAdapter: conversionNeeded ? "mock_fx" : undefined,
    targetAdapter,
    preference: intent.routePreference ?? "recipient_preferred",
    estimatedSettlementTimeMs: conversionNeeded ? 45_000 : 15_000,
    complianceLevel: quote.complianceLevel,
    mock: [sourceAdapter, targetAdapter, conversionNeeded ? "mock_fx" : ""].some(
      (id) => id.startsWith("mock_") || id.endsWith("_sandbox")
    ),
    note: conversionNeeded
      ? "Multi-leg pilot route: source rail -> mock FX -> target rail."
      : "Single-rail pilot route with private proof binding.",
  };
}