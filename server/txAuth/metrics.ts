/**
 * Phase 13 — Observability metrics for tx authorization.
 */
import type { VerifyFailureReason } from "./types.js";

export type TxAuthMetrics = {
  proof_generation_ms: number[];
  verification_ms: number[];
  success_count: number;
  failure_count: number;
  failures_by_reason: Partial<Record<VerifyFailureReason, number>>;
  challenge_expired_count: number;
  last_sync_at: number;
  registry_version: number;
};

const MAX_SAMPLES = 200;

export function recordLatency(samples: number[], ms: number) {
  samples.push(ms);
  if (samples.length > MAX_SAMPLES) samples.splice(0, samples.length - MAX_SAMPLES);
}

export function avg(samples: number[]): number {
  if (!samples.length) return 0;
  return Math.round(samples.reduce((a, b) => a + b, 0) / samples.length);
}

export function metricsView(m: TxAuthMetrics) {
  return {
    proof_generation_latency_ms_avg: avg(m.proof_generation_ms),
    verification_latency_ms_avg: avg(m.verification_ms),
    registry_synchronization_status: m.last_sync_at
      ? { ok: true, last_sync_at: new Date(m.last_sync_at).toISOString() }
      : { ok: false, last_sync_at: null },
    revocation_propagation: {
      registry_version: m.registry_version,
      note: "Nullifiers applied on next verify against updated root",
    },
    verification_success_rate:
      m.success_count + m.failure_count === 0
        ? null
        : Number((m.success_count / (m.success_count + m.failure_count)).toFixed(4)),
    failure_classifications: m.failures_by_reason,
    challenge_expiration_count: m.challenge_expired_count,
    samples: {
      proof_n: m.proof_generation_ms.length,
      verify_n: m.verification_ms.length,
    },
  };
}
