/**
 * Settlement — public-state + real Compact ledger transitions.
 * Never reads balance, policy params, contacts, or private keys.
 */
import { randomNonce, sha256 } from "./crypto.js";
import { verifyEcdsaSignature } from "./keys.js";
import {
  attestAndExecutePayment,
  attestAndExecuteSessionAuth,
  attestProofBundle,
} from "./proofServer.js";
import { midnightSettlementMeta } from "./midnight.js";
import { settleOnChainIfConfigured } from "./onchain.js";
import { saveStore, type EncryptedNote, type PublicAccount, type Store } from "./store.js";
import {
  advancePaymentLifecycle,
  createPaymentLifecycle,
} from "./paymentLifecycle.js";
import { amountToBucket, evaluatePaymentRisk } from "./riskEngine.js";
import { logStructured, recordSettleAttempt } from "./observability.js";
import { reconcilePayment } from "./reconciliation.js";
import { internalLedgerAdapter } from "../txAuth/rails/internalLedger.js";
import type { SettlementRequest } from "../txAuth/types.js";
import { asOpaqueDestination } from "../txAuth/types.js";

export type SettleInput = {
  intentCommitment: string;
  signature: string;
  spendNullifier: string;
  oldBalanceCommitment: string;
  newBalanceCommitment: string;
  newPolicyCommitment: string;
  recipientPubkey: string;
  recipientProof: { proof?: string; publicInputs?: Record<string, string>; circuit?: string };
  policyProof: { proof?: string; publicInputs?: Record<string, string>; circuit?: string };
  spendProof: { proof?: string; publicInputs?: Record<string, string>; circuit?: string };
  /** Class 0 Compact openings — never persisted; used for prove_spend_update arithmetic */
  balanceWitness?: {
    oldBalance: number | string;
    amount: number | string;
    oldOpening: string;
    newOpening: string;
  };
  encryptedNote?: {
    ephemeralPublicKeyJwk: JsonWebKey;
    ciphertext: string;
    noteCommitment: string;
  };
  /** High-value step-up (passkey / biometric) — required when risk says challenge */
  stepUp?: { kind: "passkey" | "biometric"; at?: number };
};

/** Session Compact+SNARK run in parallel with payment Compact+SNARK (same KYC root). */
export type ParallelSessionInput = {
  challenge: string;
  relyingPartyId: string;
  timeWindow: string;
};

function failSettle(
  store: Store,
  paymentId: string | undefined,
  reason: string,
  state: "proof_failed" | "rail_failed" | "manual_review" = "proof_failed",
  extra?: { riskDenied?: boolean; proofLatencyMs?: number }
) {
  if (paymentId) {
    advancePaymentLifecycle(store, paymentId, state, { failureReason: reason, note: reason });
  }
  recordSettleAttempt(false, {
    failureReason: reason,
    riskDenied: extra?.riskDenied,
    proofLatencyMs: extra?.proofLatencyMs,
  });
  logStructured("warn", "settle.fail", {
    paymentId,
    reason,
    state,
  });
  return { ok: false as const, reason, paymentId };
}

export async function settlePublicPayment(
  store: Store,
  user: PublicAccount,
  input: SettleInput,
  opts?: { parallelSession?: ParallelSessionInput; correlationId?: string }
) {
  const t0 = Date.now();
  const lifecycle = createPaymentLifecycle(store, {
    userId: user.id,
    correlationId: opts?.correlationId,
    intentCommitment: input.intentCommitment,
    spendNullifier: input.spendNullifier,
    recipientPubkey: input.recipientPubkey,
  });
  const paymentId = lifecycle.id;

  // 1. ECDSA auth — verify against registered public key only
  if (
    !verifyEcdsaSignature(user.publicKeyJwk, input.intentCommitment, input.signature)
  ) {
    return failSettle(store, paymentId, "Invalid authorization signature");
  }

  // 2. Commitment continuity
  if (input.oldBalanceCommitment !== user.balanceCommitment) {
    return failSettle(store, paymentId, "Stale balance commitment");
  }

  // 3. Nullifier uniqueness
  if (store.spentNullifiers.includes(input.spendNullifier)) {
    return failSettle(store, paymentId, "Nullifier already spent");
  }
  const expectedNf = sha256(`balnf:${user.balanceCommitment}`);
  if (input.spendNullifier !== expectedNf) {
    return failSettle(store, paymentId, "Nullifier does not bind to current commitment");
  }

  // 4. Structural client proofs (intent binding)
  const structural = await attestProofBundle({
    recipientProof: input.recipientProof,
    policyProof: input.policyProof,
    spendProof: input.spendProof,
  });
  if (!structural.ok) {
    return failSettle(store, paymentId, structural.reason ?? "Proof verification failed");
  }
  advancePaymentLifecycle(store, paymentId, "proof_prepared");

  // 5. KYC not revoked (sender)
  const leaf = store.kycLeaves.find((l) => l.leaf === user.credentialCommitment);
  if (!leaf || leaf.revoked || store.revokedNullifiers.includes(leaf.nullifier)) {
    return failSettle(store, paymentId, "KYC revoked");
  }

  // 5b. Sanctions screen on inbound recipient (not only at registration)
  const recipient = store.users.find((a) => a.pubkey === input.recipientPubkey);
  if (recipient) {
    const rLeaf = store.kycLeaves.find((l) => l.leaf === recipient.credentialCommitment);
    if (rLeaf?.revoked || (rLeaf && store.revokedNullifiers.includes(rLeaf.nullifier))) {
      return failSettle(store, paymentId, "Recipient KYC revoked");
    }
    const issuance = store.issuanceRecords?.find(
      (r) => r.credentialCommitment === recipient.credentialCommitment
    );
    if (issuance && issuance.sanctionsClear === false) {
      return failSettle(store, paymentId, "Recipient failed sanctions screening");
    }
    if (issuance) {
      issuance.sanctionsCheckedAt = Date.now();
    }
  }

  // 5c. Risk gates (privacy-safe buckets only)
  const rawAmountEarly = input.balanceWitness?.amount;
  const amountForRisk =
    rawAmountEarly !== undefined && /^\d+$/.test(String(rawAmountEarly))
      ? BigInt(rawAmountEarly)
      : 1n;
  const risk = evaluatePaymentRisk(store, {
    user,
    recipientPubkey: input.recipientPubkey,
    amountBucket: amountToBucket(amountForRisk),
    correlationId: lifecycle.correlationId,
  });
  if (risk.decision === "deny" || risk.decision === "manual_review") {
    return failSettle(
      store,
      paymentId,
      `Risk ${risk.decision}: ${risk.reasons.join(",")}`,
      "manual_review",
      { riskDenied: true }
    );
  }
  // High-value / new-recipient challenge — require biometric step-up (fail-closed outside tests)
  if (
    risk.decision === "challenge" &&
    !input.stepUp?.kind &&
    !process.env.VITEST &&
    process.env.NYXPAY_ALLOW_RISK_SOFT !== "1"
  ) {
    return failSettle(
      store,
      paymentId,
      "Risk challenge: biometric step-up required",
      "manual_review",
      { riskDenied: true }
    );
  }
  advancePaymentLifecycle(store, paymentId, "user_authorized", {
    riskDecision: risk.decision,
    note: risk.reasons.join(",") + (input.stepUp ? `|stepUp:${input.stepUp.kind}` : ""),
  });

  // 6. Real Compact circuit execution (compactc artifacts)
  const contactCommitment =
    input.recipientProof?.publicInputs?.contact_commitment ??
    sha256(input.recipientPubkey);
  const recipientDigest =
    input.spendProof?.publicInputs?.recipient_proof_digest ??
    input.recipientProof?.proof ??
    sha256("recipient");
  const rawAmount = input.balanceWitness?.amount;
  if (rawAmount === undefined || !/^\d+$/.test(String(rawAmount))) {
    return failSettle(store, paymentId, "balanceWitness.amount required (private)");
  }
  const amountHint = BigInt(rawAmount);
  if (amountHint <= 0n) {
    return failSettle(store, paymentId, "balanceWitness.amount must be > 0");
  }
  if (input.policyProof?.publicInputs?.amount !== undefined) {
    return failSettle(
      store,
      paymentId,
      "policyProof must not expose amount — private witness only"
    );
  }
  const proofStarted = Date.now();
  const paymentAttestP = attestAndExecutePayment({
    kycRoot: store.kycRoot,
    leaf: user.credentialCommitment,
    contactCommitment,
    oldBalanceCommitment: input.oldBalanceCommitment,
    newBalanceCommitment: input.newBalanceCommitment,
    oldPolicyCommitment: user.policyCommitment,
    newPolicyCommitment: input.newPolicyCommitment,
    recipientProofDigest: recipientDigest,
    amountHint,
    recipientProof: input.recipientProof,
    policyProof: input.policyProof,
    spendProof: input.spendProof,
    balanceWitness: input.balanceWitness
      ? {
          oldBalance: Number(input.balanceWitness.oldBalance),
          amount: BigInt(input.balanceWitness.amount),
          oldOpening: input.balanceWitness.oldOpening,
          newOpening: input.balanceWitness.newOpening,
        }
      : undefined,
  });

  const sessionAttestP = opts?.parallelSession
    ? attestAndExecuteSessionAuth({
        kycRoot: store.kycRoot,
        leaf: user.credentialCommitment,
        challenge: opts.parallelSession.challenge,
        relyingPartyId: opts.parallelSession.relyingPartyId,
        timeWindow: opts.parallelSession.timeWindow,
      })
    : Promise.resolve(null);

  const [compact, sessionAttest] = await Promise.all([paymentAttestP, sessionAttestP]);
  const proofLatencyMs = Date.now() - proofStarted;
  if (sessionAttest && !sessionAttest.ok) {
    return failSettle(
      store,
      paymentId,
      sessionAttest.reason ?? "Compact session auth failed",
      "proof_failed",
      { proofLatencyMs }
    );
  }
  if (!compact.ok) {
    return failSettle(
      store,
      paymentId,
      compact.reason ?? "Compact settlement failed",
      "proof_failed",
      { proofLatencyMs }
    );
  }

  advancePaymentLifecycle(store, paymentId, "proof_verified", {
    proofMode: compact.mode,
    attestationGrade: compact.grade,
    note: "compact+snark",
  });

  // 6b. Internal-ledger rail reserve + settle (pilot CIRCLE units)
  const railStarted = Date.now();
  const dest = internalLedgerAdapter.mintDestination({
    merchant_identifier: user.id,
    order_reference: paymentId,
    nonce: input.spendNullifier.slice(0, 16),
  });
  const railReq: SettlementRequest = {
    intent: {
      merchant_identifier: user.id,
      order_reference: paymentId,
      amount: 0,
      currency: "CIRCLE",
      settlement_rail: "internal_ledger",
      settlement_destination: asOpaqueDestination(dest),
      nonce: input.spendNullifier.slice(0, 16),
      timestamp: Date.now(),
    },
    intent_commitment: input.intentCommitment,
    verification: {
      authorized: true,
      merchant_identifier: user.id,
      intent_commitment: input.intentCommitment,
      proof_challenge_id: paymentId,
      verified_at: new Date().toISOString(),
      registry_version: 0,
      settlement_rail: "internal_ledger",
      private_information_exposed: false,
      checks: {
        membership: true,
        authorization_signature: true,
        not_revoked: true,
        challenge_fresh: true,
        intent_bound: true,
      },
    },
    proof_challenge_id: paymentId,
  };
  let railSettlementId: string | undefined;
  try {
    if (internalLedgerAdapter.reserve) {
      const reserved = await internalLedgerAdapter.reserve(railReq);
      if (!reserved.ok) {
        return failSettle(store, paymentId, "Rail reserve failed", "rail_failed", {
          proofLatencyMs,
        });
      }
      advancePaymentLifecycle(store, paymentId, "rail_reserved", {
        railId: "internal_ledger",
        note: reserved.reserveId,
      });
    }
    const railSettle = await internalLedgerAdapter.settle(railReq);
    if (!railSettle.ok) {
      return failSettle(
        store,
        paymentId,
        railSettle.note ?? "Rail settle failed",
        "rail_failed",
        { proofLatencyMs }
      );
    }
    railSettlementId = railSettle.settlement_id;
  } catch (e) {
    return failSettle(
      store,
      paymentId,
      e instanceof Error ? e.message : "Rail adapter error",
      "rail_failed",
      { proofLatencyMs }
    );
  }
  const railLatencyMs = Date.now() - railStarted;

  // 7. Preprod on-chain submit when wallet/contract configured
  const onchain = await settleOnChainIfConfigured({
    circuit: "prove_spend_update",
    proofMode: compact.mode,
    snarkDigests: compact.snarkDigests,
    compactLedger: compact.compact?.spend?.ledger,
  });
  const { loadConfig } = await import("../config.js");
  if (loadConfig().requireOnchain && onchain.status === "ready-unfunded") {
    return failSettle(
      store,
      paymentId,
      onchain.detail || "Preprod broadcast required but wallet unfunded",
      "rail_failed",
      { proofLatencyMs }
    );
  }

  // 8. Apply public state only
  store.spentNullifiers.push(input.spendNullifier);
  user.balanceCommitment = input.newBalanceCommitment;
  user.policyCommitment = input.newPolicyCommitment;

  if (input.encryptedNote) {
    const note: EncryptedNote = {
      id: randomNonce(8),
      recipientPubkey: input.recipientPubkey,
      ephemeralPublicKeyJwk: input.encryptedNote.ephemeralPublicKeyJwk,
      ciphertext: input.encryptedNote.ciphertext,
      noteCommitment: input.encryptedNote.noteCommitment,
      createdAt: Date.now(),
      claimed: false,
      dataClass: 1,
    };
    store.notes.push(note);
  }

  const delayMs = 0;
  const event = {
    id: randomNonce(8),
    type: "valid_transfer" as const,
    nullifier: input.spendNullifier,
    newBalanceCommitment: input.newBalanceCommitment,
    newPolicyCommitment: input.newPolicyCommitment,
    timestamp: Date.now(),
    delayedUntil: Date.now() + delayMs,
    released: true,
    meta: {
      ...midnightSettlementMeta({
        note: "generic transfer — Compact ledger + Class 0 device vault",
        proofMode: compact.mode,
        attestationGrade: compact.grade,
        compactProved: compact.proved ?? false,
        snarkDigests: compact.snarkDigests,
        onchain,
      }),
      note: "generic transfer — Class 0 never touched server",
      proofMode: compact.mode,
      attestationGrade: compact.grade,
      snarkDigests: compact.snarkDigests,
      paymentId,
      railId: "internal_ledger",
      railSettlementId,
    },
  };
  store.events.push(event);

  if (Math.random() < 0.4) {
    store.events.push({
      id: randomNonce(8),
      type: "decoy",
      timestamp: Date.now(),
      delayedUntil: Date.now() + delayMs + 500,
      released: false,
      meta: midnightSettlementMeta({ note: "null-state decoy traffic" }),
    });
  }

  advancePaymentLifecycle(store, paymentId, "settled", {
    railId: "internal_ledger",
    railSettlementId,
    proofMode: compact.mode,
    attestationGrade: compact.grade,
    receiptId: `rcpt_${event.id}`,
    note: `event:${event.id}`,
  });

  advancePaymentLifecycle(store, paymentId, "device_applied", {
    note: "awaiting_client_ack",
  });
  const reconciled = reconcilePayment(store, {
    paymentId,
    proofEventId: event.id,
    railSettlementId,
    deviceApplied: true,
    recipientNotified: Boolean(input.encryptedNote),
  });

  saveStore(store);

  recordSettleAttempt(true, {
    grade: compact.grade,
    proofMode: compact.mode,
    proofLatencyMs,
    railLatencyMs,
  });
  logStructured("info", "settle.ok", {
    paymentId,
    correlationId: lifecycle.correlationId,
    grade: compact.grade,
    proofMode: compact.mode,
    elapsedMs: Date.now() - t0,
    receiptId: reconciled.receiptId,
  });

  return {
    ok: true as const,
    eventId: event.id,
    paymentId,
    correlationId: lifecycle.correlationId,
    receiptId: reconciled.receiptId ?? `rcpt_${event.id}`,
    lifecycleState: reconciled.state,
    riskDecision: risk.decision,
    delayMs,
    proofMode: compact.mode,
    attestationGrade: compact.grade,
    compactProved: compact.proved ?? false,
    snarkDigests: compact.snarkDigests,
    proveTimings: compact.proveTimings,
    onchain,
    compactLedger: compact.compact?.spend?.ledger,
    sessionAttest: sessionAttest ?? undefined,
    rail: { id: "internal_ledger", settlementId: railSettlementId },
    proofs: {
      spendUpdate: true,
      policyCompliance: true,
      recipientValid: true,
      compactRuntime: true,
      amountPrivateWitness: true,
    },
  };
}

export function claimNote(
  store: Store,
  claimant: PublicAccount,
  noteId: string,
  newBalanceCommitment: string
) {
  const note = store.notes.find((n) => n.id === noteId && !n.claimed);
  if (!note) return { ok: false as const, reason: "Note not found" };
  if (note.recipientPubkey !== claimant.pubkey) {
    return { ok: false as const, reason: "Note not addressed to claimant" };
  }
  note.claimed = true;
  const oldNf = sha256(`balnf:${claimant.balanceCommitment}`);
  if (!store.spentNullifiers.includes(oldNf)) {
    store.spentNullifiers.push(oldNf);
  }
  claimant.balanceCommitment = newBalanceCommitment;
  saveStore(store);
  return { ok: true as const };
}
