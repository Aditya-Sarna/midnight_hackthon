import { describe, it, expect } from "vitest";
import { planSplit } from "./splitPay";

describe("planSplit", () => {
  it("builds opaque note commitments for each leg", () => {
    const plan = planSplit([
      { recipientLabel: "Ada", amount: 10 },
      { recipientLabel: "Bob", amount: 15 },
      { recipientLabel: "Cia", amount: 5 },
    ]);
    expect(plan.total).toBe(30);
    expect(plan.noteCommitments).toHaveLength(3);
    expect(new Set(plan.noteCommitments).size).toBe(3);
  });

  it("rejects fewer than two legs", () => {
    expect(() => planSplit([{ recipientLabel: "Ada", amount: 10 }])).toThrow(/two/i);
  });
});
