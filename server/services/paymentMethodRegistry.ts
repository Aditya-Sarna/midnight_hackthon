export type PaymentMethodDefinition = {
  id: string;
  label: string;
  direction: "debit" | "credit" | "both";
  supportedAssets: string[];
  refundSupport: boolean;
  kycRequired: boolean;
  readiness: "live_pilot" | "mock" | "provider_required";
  note: string;
};

const METHODS: PaymentMethodDefinition[] = [
  {
    id: "internal_ledger",
    label: "Internal ledger",
    direction: "both",
    supportedAssets: ["CIRCLE_UNIT"],
    refundSupport: true,
    kycRequired: false,
    readiness: "live_pilot",
    note: "Capped pilot rail; not a licensed bank/card/UPI rail.",
  },
  {
    id: "upi",
    label: "UPI",
    direction: "both",
    supportedAssets: ["INR"],
    refundSupport: true,
    kycRequired: true,
    readiness: "provider_required",
    note: "Production requires licensed PSP/bank integration; mock adapter is demo-only.",
  },
  {
    id: "card",
    label: "Card",
    direction: "debit",
    supportedAssets: ["INR", "USD"],
    refundSupport: true,
    kycRequired: true,
    readiness: "provider_required",
    note: "Card authorization/capture requires processor integration; mock adapter is demo-only.",
  },
  {
    id: "stablecoin_wallet",
    label: "Stablecoin wallet",
    direction: "both",
    supportedAssets: ["USDC"],
    refundSupport: true,
    kycRequired: true,
    readiness: "provider_required",
    note: "Production needs wallet screening, issuer/provider support, and jurisdiction policy.",
  },
  {
    id: "partner_ledger",
    label: "Partner ledger",
    direction: "both",
    supportedAssets: ["INR", "USD", "USDC", "CIRCLE_UNIT"],
    refundSupport: true,
    kycRequired: true,
    readiness: "provider_required",
    note: "Licensed partner can own regulated money movement while CircleProof proves authorization.",
  },
  {
    id: "bank_sandbox",
    label: "Bank sandbox",
    direction: "credit",
    supportedAssets: ["USD", "INR"],
    refundSupport: true,
    kycRequired: true,
    readiness: "mock",
    note: "Sandbox USD/INR credit for universal adapter demos; not a licensed bank payout.",
  },
  {
    id: "bitcoin_sandbox",
    label: "Bitcoin sandbox",
    direction: "credit",
    supportedAssets: ["BTC"],
    refundSupport: true,
    kycRequired: true,
    readiness: "mock",
    note: "Sandbox BTC wallet credit; not mainnet. Production needs VASP + screening.",
  },
  {
    id: "stripe_test",
    label: "Stripe test mode",
    direction: "both",
    supportedAssets: ["USD", "BTC", "INR", "CIRCLE_UNIT"],
    refundSupport: true,
    kycRequired: true,
    readiness: "live_pilot",
    note: "Stripe TEST (sk_test_) PaymentIntent settle/refund + webhook; or local Stripe-test ledger via NYXPAY_UNIVERSAL_LOCAL_STRIPE=1. Not sk_live_ / not licensed bank.",
  },
];

export function listPaymentMethods(): PaymentMethodDefinition[] {
  return METHODS;
}

export function getPaymentMethod(id: string): PaymentMethodDefinition | undefined {
  return METHODS.find((method) => method.id === id);
}

export function paymentMethodRegistryDocument() {
  return {
    ok: true,
    methods: listPaymentMethods(),
  };
}