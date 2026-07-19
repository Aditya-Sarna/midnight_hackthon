/**
 * Durable serialization for the universal adapter platform.
 * Types only — Maps live in universalService; hydrate/persist there.
 */
import type { UniversalPaymentIntent, UniversalQuote } from "./quoteEngine.js";
import type { RoutePlan } from "./routePlanner.js";
import type { SandboxAccount } from "./sandboxAccounts.js";

export type RouteComplianceDecision =
  | "allow"
  | "challenge"
  | "deny"
  | "manual_review"
  | "enhanced_kyc_required"
  | "selective_disclosure_required";

export type UniversalPaymentRecord = {
  id: string;
  quoteId: string;
  routeId: string;
  routeCommitment: string;
  intentCommitment: string;
  sourceAsset: string;
  targetAsset: string;
  sourceAdapter: string;
  conversionAdapter?: string;
  targetAdapter: string;
  sourceSettlementId?: string;
  conversionSettlementId?: string;
  targetSettlementId?: string;
  receiptId: string;
  lifecycleState: string;
  riskDecision: RouteComplianceDecision;
  proofMode?: string;
  attestationGrade?: string;
  circuit?: string;
  snarkDigest?: string;
  bindingDigest?: string;
  proveMs?: number;
  reconciliationGaps: string[];
  createdAt: number;
  updatedAt: number;
  timeline: Array<{ at: number; state: string; note?: string }>;
};

export type StoredQuotePersist = UniversalQuote & {
  intent: UniversalPaymentIntent;
  accountId: string;
  createdAt: number;
};

export type StoredRoutePersist = RoutePlan & {
  intent: UniversalPaymentIntent;
  accountId: string;
  routeCommitment: string;
  compliance: RouteComplianceDecision;
  createdAt: number;
};

export type UniversalMetricsPersist = {
  quotes: number;
  routes: number;
  settled: number;
  failed: number;
  refunds: number;
  riskHolds: number;
  sanctionsBlocks: number;
  tamperRejects: number;
};

export type RailLedgerPersist = {
  ledger: Record<string, unknown>;
  idempotency: Record<string, string>;
  webhookEvents: string[];
};

export type UniversalPersistBucket = {
  quotes: Record<string, StoredQuotePersist>;
  routes: Record<string, StoredRoutePersist>;
  payments: Record<string, UniversalPaymentRecord>;
  metrics: UniversalMetricsPersist;
  sandboxAccounts: SandboxAccount[];
  stripeLedger?: RailLedgerPersist;
  sandboxPspLedger?: RailLedgerPersist;
};
