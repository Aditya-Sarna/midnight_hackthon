export type PolicyTemplateId = "T1" | "T2" | "T3" | "T4" | "T5";

export interface PolicyParams {
  T1?: { categoryId: string; period: "day" | "week" | "month"; cap: number };
  T2?: { amountThreshold: number };
  T3?: { categoryId: string };
  T4?: { startHour: number; endHour: number; allow: boolean };
  T5?: { cap: number };
}

export interface PolicyState {
  active: PolicyTemplateId[];
  params: PolicyParams;
  periodCounters: Record<string, number>;
  nonce: string;
  commitment: string;
}

export interface SpendInput {
  amount: number;
  category: string;
  timestamp: number; // unix ms
}

export interface PolicyCheckResult {
  ok: boolean;
  reason?: string;
  requiresSecondaryConfirm?: boolean;
  updatedCounters: Record<string, number>;
}

function periodKey(categoryId: string, period: string, ts: number): string {
  const d = new Date(ts);
  if (period === "day") return `${categoryId}:d:${d.toISOString().slice(0, 10)}`;
  if (period === "week") {
    const week = Math.floor(d.getTime() / (7 * 86400000));
    return `${categoryId}:w:${week}`;
  }
  return `${categoryId}:m:${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`;
}

export function evaluatePolicy(policy: PolicyState, spend: SpendInput): PolicyCheckResult {
  const counters = { ...policy.periodCounters };
  let requiresSecondaryConfirm = false;

  for (const t of policy.active) {
    if (t === "T1" && policy.params.T1) {
      const { categoryId, period, cap } = policy.params.T1;
      if (spend.category === categoryId) {
        const key = periodKey(categoryId, period, spend.timestamp);
        const next = (counters[key] ?? 0) + spend.amount;
        if (next > cap) {
          return {
            ok: false,
            reason: `T1 category_cap exceeded (${categoryId} ${period})`,
            updatedCounters: counters,
          };
        }
        counters[key] = next;
      }
    }
    if (t === "T2" && policy.params.T2) {
      if (spend.amount >= policy.params.T2.amountThreshold) {
        requiresSecondaryConfirm = true;
      }
    }
    if (t === "T3" && policy.params.T3) {
      if (spend.category === policy.params.T3.categoryId) {
        return {
          ok: false,
          reason: `T3 category_blocklist (${spend.category})`,
          updatedCounters: counters,
        };
      }
    }
    if (t === "T4" && policy.params.T4) {
      const hour = new Date(spend.timestamp).getHours();
      const { startHour, endHour, allow } = policy.params.T4;
      const inWindow =
        startHour <= endHour
          ? hour >= startHour && hour < endHour
          : hour >= startHour || hour < endHour;
      if (allow && !inWindow) {
        return { ok: false, reason: "T4 outside allowed time_window", updatedCounters: counters };
      }
      if (!allow && inWindow) {
        return { ok: false, reason: "T4 inside denied time_window", updatedCounters: counters };
      }
    }
    if (t === "T5" && policy.params.T5) {
      if (spend.amount > policy.params.T5.cap) {
        return {
          ok: false,
          reason: `T5 per_tx_cap exceeded (max ${policy.params.T5.cap})`,
          updatedCounters: counters,
        };
      }
    }
  }

  return { ok: true, requiresSecondaryConfirm, updatedCounters: counters };
}
