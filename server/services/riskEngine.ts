/**
 * Pre-settlement risk gates — privacy-safe signals only.
 * Decisions: allow | challenge | deny | manual_review
 */
import type { Store } from "./store.js";
import type { PublicAccount } from "./store.js";

export type RiskDecision = "allow" | "challenge" | "deny" | "manual_review";

export type RiskVerdict = {
  decision: RiskDecision;
  reasons: string[];
  signals: Record<string, number | boolean | string>;
};

export type RiskInput = {
  user: PublicAccount;
  recipientPubkey: string;
  /** Bucketed amount for velocity only — not persisted */
  amountBucket: "micro" | "low" | "mid" | "high";
  correlationId: string;
};

const HOUR_MS = 60 * 60_000;
const DAY_MS = 24 * HOUR_MS;

/** Soft pilot caps — CIRCLE units are product units, not INR */
const LIMITS = {
  maxSettlesPerHour: 12,
  maxSettlesPerDay: 40,
  maxDistinctRecipientsPerDay: 15,
  firstPaymentCooldownMs: 30_000,
  maxFailedProofsPerHour: 8,
  highValueRequiresChallenge: true,
};

function recentEvents(store: Store, userId: string, since: number) {
  return (store.paymentLifecycle ?? []).filter(
    (p) => p.userId === userId && p.createdAt >= since
  );
}

export function evaluatePaymentRisk(store: Store, input: RiskInput): RiskVerdict {
  const reasons: string[] = [];
  const now = Date.now();
  const hour = recentEvents(store, input.user.id, now - HOUR_MS);
  const day = recentEvents(store, input.user.id, now - DAY_MS);

  const settledHour = hour.filter((p) =>
    ["settled", "device_applied", "recipient_notified", "reconciled"].includes(p.state)
  ).length;
  const settledDay = day.filter((p) =>
    ["settled", "device_applied", "recipient_notified", "reconciled"].includes(p.state)
  ).length;
  const failedProofsHour = hour.filter((p) => p.state === "proof_failed").length;
  const distinctRecipients = new Set(day.map((p) => p.recipientPubkeyPrefix)).size;

  const signals: RiskVerdict["signals"] = {
    settlesLastHour: settledHour,
    settlesLastDay: settledDay,
    failedProofsLastHour: failedProofsHour,
    distinctRecipientsDay: distinctRecipients,
    amountBucket: input.amountBucket,
    accountAgeMs: now - (input.user.createdAt ?? now),
  };

  if ((input.user as { riskLocked?: boolean }).riskLocked) {
    return {
      decision: "deny",
      reasons: ["account_locked"],
      signals,
    };
  }

  if (failedProofsHour >= LIMITS.maxFailedProofsPerHour) {
    return {
      decision: "manual_review",
      reasons: ["failed_proof_anomaly"],
      signals,
    };
  }

  if (settledHour >= LIMITS.maxSettlesPerHour) {
    return { decision: "deny", reasons: ["velocity_hour"], signals };
  }
  if (settledDay >= LIMITS.maxSettlesPerDay) {
    return { decision: "deny", reasons: ["velocity_day"], signals };
  }
  if (distinctRecipients > LIMITS.maxDistinctRecipientsPerDay) {
    return { decision: "deny", reasons: ["recipient_fanout"], signals };
  }

  const priorToRecipient = (store.paymentLifecycle ?? []).some(
    (p) =>
      p.userId === input.user.id &&
      p.recipientPubkeyPrefix === input.recipientPubkey.slice(0, 16) &&
      ["settled", "reconciled", "device_applied"].includes(p.state)
  );

  if (!priorToRecipient) {
    const lastCreated = hour.sort((a, b) => b.createdAt - a.createdAt)[0];
    if (
      lastCreated &&
      now - lastCreated.createdAt < LIMITS.firstPaymentCooldownMs &&
      lastCreated.recipientPubkeyPrefix !== input.recipientPubkey.slice(0, 16)
    ) {
      reasons.push("new_recipient_cooldown");
    }
    reasons.push("new_recipient");
  }

  if (
    LIMITS.highValueRequiresChallenge &&
    (input.amountBucket === "high" || input.amountBucket === "mid")
  ) {
    reasons.push("value_challenge");
    return { decision: "challenge", reasons, signals };
  }

  if (reasons.includes("new_recipient_cooldown")) {
    return { decision: "challenge", reasons, signals };
  }

  return { decision: "allow", reasons: reasons.length ? reasons : ["clean"], signals };
}

export function amountToBucket(amount: bigint): RiskInput["amountBucket"] {
  if (amount <= 50n) return "micro";
  if (amount <= 500n) return "low";
  if (amount <= 5000n) return "mid";
  return "high";
}
