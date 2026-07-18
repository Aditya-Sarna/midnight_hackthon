/**
 * Multi-party splits — one settle intent, N encrypted notes (demo path).
 * Each recipient gets an opaque note commitment; amounts stay Class 0.
 */

export type SplitLeg = {
  recipientLabel: string;
  amount: number;
};

export type SplitPlan = {
  total: number;
  legs: SplitLeg[];
  noteCommitments: string[];
};

function noteCommitment(salt: string, i: number, leg: SplitLeg): string {
  const raw = `splitnote:${salt}|${i}|${leg.recipientLabel}|${leg.amount}`;
  let h = 2166136261;
  for (let c = 0; c < raw.length; c++) {
    h ^= raw.charCodeAt(c);
    h = Math.imul(h, 16777619);
  }
  return `nc_${(h >>> 0).toString(16).padStart(8, "0")}_${i}`;
}

export function planSplit(legs: SplitLeg[], salt = "circled-split"): SplitPlan {
  if (legs.length < 2) {
    throw new Error("Split requires at least two recipients");
  }
  if (legs.some((l) => !Number.isFinite(l.amount) || l.amount <= 0)) {
    throw new Error("Each split leg needs a positive amount");
  }
  const total = legs.reduce((s, l) => s + l.amount, 0);
  const noteCommitments = legs.map((l, i) => noteCommitment(salt, i, l));
  return { total, legs, noteCommitments };
}
