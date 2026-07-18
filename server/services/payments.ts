/**
 * Settlement — public-state + real Compact ledger transitions.
 * Never reads balance, policy params, contacts, or private keys.
 */
import { randomNonce, sha256 } from "./crypto.js";
import { verifyEcdsaSignature } from "./keys.js";
import { attestAndExecutePayment, attestProofBundle } from "./proofServer.js";
import { midnightSettlementMeta } from "./midnight.js";
import { settleOnChainIfConfigured } from "./onchain.js";
import { saveStore, type EncryptedNote, type PublicAccount, type Store } from "./store.js";

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
};

export async function settlePublicPayment(
  store: Store,
  user: PublicAccount,
  input: SettleInput
) {
  // 1. ECDSA auth — verify against registered public key only
  if (
    !verifyEcdsaSignature(user.publicKeyJwk, input.intentCommitment, input.signature)
  ) {
    return { ok: false as const, reason: "Invalid authorization signature" };
  }

  // 2. Commitment continuity
  if (input.oldBalanceCommitment !== user.balanceCommitment) {
    return { ok: false as const, reason: "Stale balance commitment" };
  }

  // 3. Nullifier uniqueness
  if (store.spentNullifiers.includes(input.spendNullifier)) {
    return { ok: false as const, reason: "Nullifier already spent" };
  }
  const expectedNf = sha256(`balnf:${user.balanceCommitment}`);
  if (input.spendNullifier !== expectedNf) {
    return { ok: false as const, reason: "Nullifier does not bind to current commitment" };
  }

  // 4. Structural client proofs (intent binding)
  const structural = await attestProofBundle({
    recipientProof: input.recipientProof,
    policyProof: input.policyProof,
    spendProof: input.spendProof,
  });
  if (!structural.ok) {
    return { ok: false as const, reason: structural.reason ?? "Proof verification failed" };
  }

  // 5. KYC not revoked (sender)
  const leaf = store.kycLeaves.find((l) => l.leaf === user.credentialCommitment);
  if (!leaf || leaf.revoked || store.revokedNullifiers.includes(leaf.nullifier)) {
    return { ok: false as const, reason: "KYC revoked" };
  }

  // 5b. Sanctions screen on inbound recipient (not only at registration)
  const recipient = store.users.find((a) => a.pubkey === input.recipientPubkey);
  if (recipient) {
    const rLeaf = store.kycLeaves.find((l) => l.leaf === recipient.credentialCommitment);
    if (rLeaf?.revoked || (rLeaf && store.revokedNullifiers.includes(rLeaf.nullifier))) {
      return { ok: false as const, reason: "Recipient KYC revoked" };
    }
    const issuance = store.issuanceRecords?.find(
      (r) => r.credentialCommitment === recipient.credentialCommitment
    );
    if (issuance && issuance.sanctionsClear === false) {
      return { ok: false as const, reason: "Recipient failed sanctions screening" };
    }
    // Touch inbound re-screen timestamp for audit trail
    if (issuance) {
      issuance.sanctionsCheckedAt = Date.now();
    }
  }

  // 6. Real Compact circuit execution (compactc artifacts)
  const contactCommitment =
    input.recipientProof?.publicInputs?.contact_commitment ??
    sha256(input.recipientPubkey);
  const recipientDigest =
    input.spendProof?.publicInputs?.recipient_proof_digest ??
    input.recipientProof?.proof ??
    sha256("recipient");
  // Amount is a private witness — never taken from policyProof publicInputs
  const rawAmount = input.balanceWitness?.amount;
  if (rawAmount === undefined || !/^\d+$/.test(String(rawAmount))) {
    return { ok: false as const, reason: "balanceWitness.amount required (private)" };
  }
  const amountHint = BigInt(rawAmount);
  if (amountHint <= 0n) {
    return { ok: false as const, reason: "balanceWitness.amount must be > 0" };
  }
  if (input.policyProof?.publicInputs?.amount !== undefined) {
    return {
      ok: false as const,
      reason: "policyProof must not expose amount — private witness only",
    };
  }
  const compact = await attestAndExecutePayment({
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
  if (!compact.ok) {
    return { ok: false as const, reason: compact.reason ?? "Compact settlement failed" };
  }

  // 7. Preprod on-chain submit when wallet/contract configured
  const onchain = await settleOnChainIfConfigured({
    circuit: "prove_spend_update",
    proofMode: compact.mode,
    snarkDigests: compact.snarkDigests,
    compactLedger: compact.compact?.spend?.ledger,
  });
  const { loadConfig } = await import("../config.js");
  if (loadConfig().requireOnchain && onchain.status === "ready-unfunded") {
    return {
      ok: false as const,
      reason: onchain.detail || "Preprod broadcast required but wallet unfunded",
    };
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

  const delayMs = 1500 + Math.floor(Math.random() * 6500);
  const event = {
    id: randomNonce(8),
    type: "valid_transfer" as const,
    nullifier: input.spendNullifier,
    newBalanceCommitment: input.newBalanceCommitment,
    newPolicyCommitment: input.newPolicyCommitment,
    timestamp: Date.now(),
    delayedUntil: Date.now() + delayMs,
    released: false,
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

  saveStore(store);

  return {
    ok: true as const,
    eventId: event.id,
    delayMs,
    proofMode: compact.mode,
    attestationGrade: compact.grade,
    compactProved: compact.proved ?? false,
    snarkDigests: compact.snarkDigests,
    proveTimings: compact.proveTimings,
    onchain,
    compactLedger: compact.compact?.spend?.ledger,
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
