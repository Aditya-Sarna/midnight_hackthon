/**
 * FATF Travel Rule bridge — above-threshold transfers issue a selective-disclosure
 * view key commitment for the compliance officer only (not the counterparty).
 */
export const TRAVEL_RULE_THRESHOLD = 1000;

export type TravelRuleResult = {
  required: boolean;
  amount: number;
  viewKeyCommitment?: string;
  issuedAt?: number;
  note: string;
};

export async function maybeIssueTravelRuleDisclosure(input: {
  amount: number;
  userId: string;
  intentCommitment: string;
}): Promise<TravelRuleResult> {
  if (input.amount < TRAVEL_RULE_THRESHOLD) {
    return {
      required: false,
      amount: input.amount,
      note: "Below Travel Rule threshold — no selective disclosure",
    };
  }
  try {
    const res = await fetch(`/api/users/${encodeURIComponent(input.userId)}/view-key`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        purpose: "fatf-travel-rule",
        bind: input.intentCommitment,
        threshold: TRAVEL_RULE_THRESHOLD,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      return {
        required: true,
        amount: input.amount,
        note: data.error || "Travel Rule disclosure deferred",
      };
    }
    return {
      required: true,
      amount: input.amount,
      viewKeyCommitment: data.viewKeyCommitment || data.commitment,
      issuedAt: Date.now(),
      note: "Selective disclosure issued to compliance officer only",
    };
  } catch {
    return {
      required: true,
      amount: input.amount,
      note: "Travel Rule path unavailable — settle blocked in strict compliance mode only",
    };
  }
}
