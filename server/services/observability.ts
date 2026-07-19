/**
 * Structured ops logging + settle metrics with strict redaction.
 * Never log amounts, contacts, voice, openings, witnesses, or raw IDs.
 */
export type LogLevel = "info" | "warn" | "error";

const REDACT_KEYS =
  /amount|balance|contact|transcript|utterance|opening|witness|private|secret|password|passphrase|mnemonic|ciphertext|noteCommitment|govt|aadhaar|pan|voice/i;

export function redactValue(key: string, value: unknown): unknown {
  if (REDACT_KEYS.test(key)) return "[redacted]";
  if (typeof value === "string" && value.length > 64) {
    return `${value.slice(0, 12)}…[${value.length}]`;
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return redactObject(value as Record<string, unknown>);
  }
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((v, i) => redactValue(String(i), v));
  }
  return value;
}

export function redactObject(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = redactValue(k, v);
  }
  return out;
}

export function logStructured(
  level: LogLevel,
  event: string,
  fields: Record<string, unknown> = {}
) {
  const line = {
    ts: new Date().toISOString(),
    level,
    event,
    ...redactObject(fields),
  };
  const msg = JSON.stringify(line);
  if (level === "error") console.error(msg);
  else if (level === "warn") console.warn(msg);
  else console.log(msg);
}

export type SettleMetrics = {
  attempts: number;
  success: number;
  failure: number;
  byGrade: Record<string, number>;
  byProofMode: Record<string, number>;
  byFailure: Record<string, number>;
  proofLatencyMs: number[];
  railLatencyMs: number[];
  riskDenies: number;
  vaultRepairHints: number;
};

const MAX = 200;
const metrics: SettleMetrics = {
  attempts: 0,
  success: 0,
  failure: 0,
  byGrade: {},
  byProofMode: {},
  byFailure: {},
  proofLatencyMs: [],
  railLatencyMs: [],
  riskDenies: 0,
  vaultRepairHints: 0,
};

function pushSample(arr: number[], ms: number) {
  arr.push(ms);
  if (arr.length > MAX) arr.splice(0, arr.length - MAX);
}

function avg(arr: number[]) {
  if (!arr.length) return 0;
  return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
}

export function recordSettleAttempt(ok: boolean, meta: {
  grade?: string;
  proofMode?: string;
  failureReason?: string;
  proofLatencyMs?: number;
  railLatencyMs?: number;
  riskDenied?: boolean;
}) {
  metrics.attempts += 1;
  if (ok) metrics.success += 1;
  else metrics.failure += 1;
  if (meta.grade) metrics.byGrade[meta.grade] = (metrics.byGrade[meta.grade] ?? 0) + 1;
  if (meta.proofMode)
    metrics.byProofMode[meta.proofMode] = (metrics.byProofMode[meta.proofMode] ?? 0) + 1;
  if (meta.failureReason) {
    const key = meta.failureReason.slice(0, 80);
    metrics.byFailure[key] = (metrics.byFailure[key] ?? 0) + 1;
  }
  if (meta.proofLatencyMs != null) pushSample(metrics.proofLatencyMs, meta.proofLatencyMs);
  if (meta.railLatencyMs != null) pushSample(metrics.railLatencyMs, meta.railLatencyMs);
  if (meta.riskDenied) metrics.riskDenies += 1;
}

export function recordVaultRepairHint() {
  metrics.vaultRepairHints += 1;
}

export function settleMetricsView() {
  return {
    attempts: metrics.attempts,
    success: metrics.success,
    failure: metrics.failure,
    successRate:
      metrics.attempts === 0
        ? null
        : Number((metrics.success / metrics.attempts).toFixed(4)),
    byGrade: metrics.byGrade,
    byProofMode: metrics.byProofMode,
    byFailure: metrics.byFailure,
    proof_latency_ms_avg: avg(metrics.proofLatencyMs),
    rail_latency_ms_avg: avg(metrics.railLatencyMs),
    riskDenies: metrics.riskDenies,
    vaultRepairHints: metrics.vaultRepairHints,
  };
}

/** Test helper */
export function resetSettleMetrics() {
  metrics.attempts = 0;
  metrics.success = 0;
  metrics.failure = 0;
  metrics.byGrade = {};
  metrics.byProofMode = {};
  metrics.byFailure = {};
  metrics.proofLatencyMs = [];
  metrics.railLatencyMs = [];
  metrics.riskDenies = 0;
  metrics.vaultRepairHints = 0;
}
