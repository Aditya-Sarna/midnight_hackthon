import { describe, it, expect } from "vitest";
import { evaluatePolicy } from "./policy";
import type { PolicyState } from "./policy";

function makePolicy(overrides: Partial<PolicyState> = {}): PolicyState {
  return {
    active: [],
    params: {},
    periodCounters: {},
    nonce: "test-nonce",
    commitment: "test-commitment",
    ...overrides,
  };
}

const NOW = new Date("2026-07-18T14:00:00Z").getTime(); // 14:00 UTC

describe("evaluatePolicy — no templates", () => {
  it("allows any spend when no templates are active", () => {
    const result = evaluatePolicy(makePolicy(), { amount: 9999, category: "general", timestamp: NOW });
    expect(result.ok).toBe(true);
    expect(result.requiresSecondaryConfirm).toBeFalsy();
  });
});

describe("evaluatePolicy — T1 (category period cap)", () => {
  const base = makePolicy({
    active: ["T1"],
    params: { T1: { categoryId: "food", period: "day", cap: 500 } },
  });

  it("allows spend under the daily cap", () => {
    const result = evaluatePolicy(base, { amount: 300, category: "food", timestamp: NOW });
    expect(result.ok).toBe(true);
  });

  it("blocks spend over the daily cap", () => {
    const result = evaluatePolicy(base, { amount: 600, category: "food", timestamp: NOW });
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("T1");
  });

  it("accumulates with existing counter and blocks when cumulative cap exceeded", () => {
    const withCounter = makePolicy({
      active: ["T1"],
      params: { T1: { categoryId: "food", period: "day", cap: 500 } },
      periodCounters: { [`food:d:${new Date(NOW).toISOString().slice(0, 10)}`]: 400 },
    });
    // 400 + 200 = 600 > 500
    const result = evaluatePolicy(withCounter, { amount: 200, category: "food", timestamp: NOW });
    expect(result.ok).toBe(false);
  });

  it("does not block unrelated categories", () => {
    const result = evaluatePolicy(base, { amount: 600, category: "transport", timestamp: NOW });
    expect(result.ok).toBe(true);
  });
});

describe("evaluatePolicy — T2 (high-value confirm)", () => {
  const base = makePolicy({ active: ["T2"], params: { T2: { amountThreshold: 500 } } });

  it("flags requiresSecondaryConfirm at or above threshold", () => {
    expect(evaluatePolicy(base, { amount: 500, category: "general", timestamp: NOW }).requiresSecondaryConfirm).toBe(true);
    expect(evaluatePolicy(base, { amount: 1000, category: "general", timestamp: NOW }).requiresSecondaryConfirm).toBe(true);
  });

  it("does not flag below threshold", () => {
    expect(evaluatePolicy(base, { amount: 499, category: "general", timestamp: NOW }).requiresSecondaryConfirm).toBeFalsy();
  });

  it("still returns ok:true regardless", () => {
    expect(evaluatePolicy(base, { amount: 9999, category: "general", timestamp: NOW }).ok).toBe(true);
  });
});

describe("evaluatePolicy — T3 (category blocklist)", () => {
  const base = makePolicy({ active: ["T3"], params: { T3: { categoryId: "gambling" } } });

  it("blocks the blocklisted category", () => {
    const result = evaluatePolicy(base, { amount: 1, category: "gambling", timestamp: NOW });
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("T3");
  });

  it("allows all other categories", () => {
    expect(evaluatePolicy(base, { amount: 1000, category: "food", timestamp: NOW }).ok).toBe(true);
    expect(evaluatePolicy(base, { amount: 1000, category: "general", timestamp: NOW }).ok).toBe(true);
  });
});

describe("evaluatePolicy — T4 (time window)", () => {
  // Use local hours to match the Date.getHours() call inside evaluatePolicy.
  const localHour = new Date(NOW).getHours();
  const windowStart = Math.max(0, localHour - 2);
  const windowEnd = Math.min(23, localHour + 2);
  const outsideWindowTs = (() => {
    const d = new Date(NOW);
    // Pick a time 12 hours away (wrapping around midnight) — will always be outside a 4-hour window
    d.setHours((localHour + 12) % 24, 0, 0, 0);
    return d.getTime();
  })();

  it("allows spend inside an allowed window", () => {
    const policy = makePolicy({
      active: ["T4"],
      params: { T4: { startHour: windowStart, endHour: windowEnd, allow: true } },
    });
    expect(evaluatePolicy(policy, { amount: 100, category: "general", timestamp: NOW }).ok).toBe(true);
  });

  it("blocks spend outside an allowed window", () => {
    const policy = makePolicy({
      active: ["T4"],
      params: { T4: { startHour: windowStart, endHour: windowEnd, allow: true } },
    });
    expect(evaluatePolicy(policy, { amount: 100, category: "general", timestamp: outsideWindowTs }).ok).toBe(false);
  });

  it("blocks spend inside a denied window", () => {
    const policy = makePolicy({
      active: ["T4"],
      params: { T4: { startHour: windowStart, endHour: windowEnd, allow: false } },
    });
    expect(evaluatePolicy(policy, { amount: 100, category: "general", timestamp: NOW }).ok).toBe(false);
  });
});

describe("evaluatePolicy — T5 (per-tx cap)", () => {
  const base = makePolicy({ active: ["T5"], params: { T5: { cap: 1000 } } });

  it("allows spend at or below the cap", () => {
    expect(evaluatePolicy(base, { amount: 1000, category: "general", timestamp: NOW }).ok).toBe(true);
    expect(evaluatePolicy(base, { amount: 500, category: "general", timestamp: NOW }).ok).toBe(true);
  });

  it("blocks spend above the cap", () => {
    const result = evaluatePolicy(base, { amount: 1001, category: "general", timestamp: NOW });
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("T5");
  });
});

describe("evaluatePolicy — T6 (recurring schedule)", () => {
  const nextAt = NOW;
  const base = makePolicy({
    active: ["T6"],
    params: {
      T6: {
        recipientLabel: "rent",
        amount: 50,
        intervalDays: 7,
        nextAt,
        runsCompleted: 0,
        maxRuns: 2,
      },
    },
  });

  it("advances nextAt when scheduled amount is spent on/after due date", () => {
    const result = evaluatePolicy(base, { amount: 50, category: "general", timestamp: NOW });
    expect(result.ok).toBe(true);
    expect(result.updatedParams?.T6?.runsCompleted).toBe(1);
    expect(result.updatedParams?.T6?.nextAt).toBe(nextAt + 7 * 86_400_000);
  });

  it("allows non-matching amounts without advancing schedule", () => {
    const result = evaluatePolicy(base, { amount: 10, category: "general", timestamp: NOW });
    expect(result.ok).toBe(true);
    expect(result.updatedParams).toBeUndefined();
  });

  it("blocks when maxRuns is exhausted", () => {
    const exhausted = makePolicy({
      active: ["T6"],
      params: {
        T6: {
          recipientLabel: "rent",
          amount: 50,
          intervalDays: 7,
          nextAt,
          runsCompleted: 2,
          maxRuns: 2,
        },
      },
    });
    const result = evaluatePolicy(exhausted, { amount: 50, category: "general", timestamp: NOW });
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("T6");
  });
});

describe("evaluatePolicy — combined templates", () => {
  it("enforces all active templates independently", () => {
    const policy = makePolicy({
      active: ["T2", "T3", "T5"],
      params: {
        T2: { amountThreshold: 200 },
        T3: { categoryId: "alcohol" },
        T5: { cap: 500 },
      },
    });
    // Blocked by T3
    expect(evaluatePolicy(policy, { amount: 100, category: "alcohol", timestamp: NOW }).ok).toBe(false);
    // Blocked by T5
    expect(evaluatePolicy(policy, { amount: 600, category: "food", timestamp: NOW }).ok).toBe(false);
    // T2 flag on large allowed spend
    const big = evaluatePolicy(policy, { amount: 300, category: "food", timestamp: NOW });
    expect(big.ok).toBe(true);
    expect(big.requiresSecondaryConfirm).toBe(true);
  });
});
