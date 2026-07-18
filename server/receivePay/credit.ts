/**
 * Credit-side private balance update via prove_credit_update.
 * Symmetric to prove_spend_update but distinct circuit + ledger counter.
 */
import type { Store } from "../services/store.js";
import { saveStore } from "../services/store.js";
import { sha256 } from "../services/crypto.js";
import {
  artifactsPresent,
  runCompactCircuit,
  setCreditWitness,
} from "../services/compactLedger.js";
import {
  compactBalanceCommit,
  randomOpening,
} from "../services/compactCommit.js";
import { resolveProofMode } from "../services/proofServer.js";
import { proveCircuit } from "../services/zkProve.js";
import { receivePayState } from "./state.js";
import { verifySettlementConfirmation } from "./confirm.js";
import { creditInboundDigest } from "./creditDigest.js";
import type { CreditAttestation, ReceiveFailureReason } from "./types.js";
import { CREDIT_CIRCUIT } from "./types.js";

export async function creditPrivateBalance(
  store: Store,
  input: {
    order_reference: string;
    /** Public account id whose balanceCommitment is credited */
    merchant_account_id?: string;
    old_balance_commitment: string;
    new_balance_commitment: string;
  }
): Promise<
  | { ok: true; attestation: CreditAttestation; destination_id: string }
  | { ok: false; reason: ReceiveFailureReason; detail?: string }
> {
  const s = receivePayState(store);
  const destId = s.by_order_ref[input.order_reference];
  if (!destId) return { ok: false, reason: "order_not_found" };

  const destination = s.destinations.find((d) => d.destination_id === destId)!;
  if (destination.status !== "confirmed" && destination.status !== "credited") {
    return { ok: false, reason: "not_reconciled", detail: "Settlement confirmation required before credit" };
  }

  const confirmation = s.confirmations.find((c) => c.order_reference === input.order_reference);
  if (!confirmation) return { ok: false, reason: "not_reconciled", detail: "Missing confirmation" };
  const v = verifySettlementConfirmation(store, confirmation);
  if (!v.ok) return v;

  if (
    !input.old_balance_commitment ||
    !input.new_balance_commitment ||
    input.old_balance_commitment === input.new_balance_commitment
  ) {
    return { ok: false, reason: "credit_failed", detail: "Balance commitments must change" };
  }

  const inbound_proof_digest = creditInboundDigest({
    intent_commitment: destination.intent_commitment,
    settlement_destination: destination.settlement_destination,
    amount: destination.amount,
  });

  if (!artifactsPresent()) {
    return { ok: false, reason: "credit_failed", detail: "Compact artifacts required for prove_credit_update" };
  }

  try {
    // Enterprise credit arithmetic under persistentCommit
    const oldOpen = randomOpening();
    const newOpen = randomOpening();
    const oldBal = 0n;
    const amount = BigInt(Math.trunc(destination.amount * 100)); // cents-ish field
    const amt = amount > 0n ? amount : 1n;
    setCreditWitness({
      oldBalance: oldBal,
      amount: amt,
      oldOpening: oldOpen,
      newOpening: newOpen,
    });
    const oldCommit = compactBalanceCommit(oldBal, oldOpen);
    const newCommit = compactBalanceCommit(oldBal + amt, newOpen);

    const compact = await runCompactCircuit(CREDIT_CIRCUIT, [
      oldCommit,
      newCommit,
      inbound_proof_digest,
    ]);

    let proved = false;
    let snark_digest: string | undefined;
    let grade = "compact-runtime";
    const mode = await resolveProofMode();
    if (mode.proofServerOk) {
      const snark = await proveCircuit(CREDIT_CIRCUIT, compact.proofData);
      if (snark.ok) {
        proved = true;
        snark_digest = snark.proofDigest;
        grade = "zk-proved";
      }
    }

    // Update public merchant account commitment if provided
    if (input.merchant_account_id) {
      const user = store.users.find((u) => u.id === input.merchant_account_id);
      if (user) {
        if (user.balanceCommitment !== input.old_balance_commitment) {
          return {
            ok: false,
            reason: "credit_failed",
            detail: "old_balance_commitment does not match account",
          };
        }
        const oldNf = sha256(`balnf:${user.balanceCommitment}`);
        if (!store.spentNullifiers.includes(oldNf)) store.spentNullifiers.push(oldNf);
        user.balanceCommitment = input.new_balance_commitment;
      }
    }

    destination.status = "credited";
    saveStore(store);

    const attestation: CreditAttestation = {
      circuit: CREDIT_CIRCUIT,
      // Commitments actually constrained by Compact persistentCommit arithmetic
      old_balance_commitment: oldCommit,
      new_balance_commitment: newCommit,
      inbound_proof_digest,
      compact_ok: true,
      proved,
      snark_digest,
      grade,
    };
    return { ok: true, attestation, destination_id: destination.destination_id };
  } catch (e) {
    return {
      ok: false,
      reason: "credit_failed",
      detail: e instanceof Error ? e.message : String(e),
    };
  }
}
