import { vi } from "vitest";

vi.mock("../services/midnight.js", () => ({
  initMidnightFoundation: () => ({ networkId: "testnet" }),
  probeMidnightFoundation: async () => ({ ok: true, networkId: "testnet" }),
  midnightSettlementMeta: (meta: Record<string, unknown>) => meta,
}));

vi.mock("../services/onchain.js", () => ({
  deployStatus: async () => ({
    contractAddress: null,
    readyForSubmit: false,
    walletSeedConfigured: false,
    txId: null,
  }),
  settleOnChainIfConfigured: async () => null,
}));

vi.mock("../services/proofServer.js", () => ({
  resolveProofMode: async () => ({
    mode: "compact-runtime",
    proofServerOk: false,
    artifactsOk: true,
    circuits: [
      "prove_recipient_valid",
      "prove_policy_update",
      "prove_spend_update",
      "prove_session_auth",
    ],
    detail: "mocked",
    proverKeysLoaded: [
      "prove_recipient_valid",
      "prove_spend_update",
      "prove_session_auth",
    ],
  }),
  attestProofBundle: async () => ({ ok: true, mode: "compact-runtime" }),
  attestAndExecutePayment: async () => ({
    ok: true,
    mode: "compact-runtime",
    grade: "compact-runtime",
    compact: {
      spend: {
        ledger: {
          kycRegistryRoot: "mock-root",
          spentNullifierCount: "1",
          transferCount: "1",
          spentChallengeCount: "1",
        },
      },
    },
    proved: false,
  }),
  attestAndExecuteSessionAuth: async () => ({
    ok: true,
    mode: "compact-runtime",
    grade: "compact-runtime",
    compact: {
      ok: true,
      circuit: "prove_session_auth",
      proofData: {} as never,
      ledger: {
        kycRegistryRoot: "mock-root",
        spentNullifierCount: "0",
        transferCount: "0",
        spentChallengeCount: "1",
      },
    },
    proved: false,
  }),
  attestUniversalRouteBinding: async () => ({
    ok: true,
    mode: "compact-runtime",
    grade: "compact-runtime",
    circuit: "prove_authorized_transaction",
    bindingDigest: "b".repeat(64),
    proveMs: 12,
    reason: "mocked",
  }),
}));
