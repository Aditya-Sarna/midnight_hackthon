/**
 * Selective disclosure — SAR path option 2.
 * Backend stores view-key *commitment* only. Auditor payload is client-supplied
 * and verified against the commitment; server never holds Class 0 balance.
 */
import { commit, hmacSign, randomNonce, sha256 } from "../../services/crypto.js";
import type { PublicAccount, Store } from "../../services/store.js";
import { saveStore } from "../../services/store.js";

export class SelectiveDisclosureService {
  constructor(private store: Store) {}

  issueViewKeyCommitment(user: PublicAccount) {
    const viewKey = randomNonce(32);
    const viewKeyCommitment = commit(viewKey, user.id);
    if (!this.store.viewKeyCommitments) this.store.viewKeyCommitments = {};
    this.store.viewKeyCommitments[user.id] = {
      commitment: viewKeyCommitment,
      issuedAt: Date.now(),
      dataClass: 1,
    };
    saveStore(this.store);
    return {
      viewKey,
      viewKeyCommitment,
      note: "Store viewKey on-device only. Backend retains commitment. Compellable under lawful order.",
      disclosedGap: "sar-str",
    };
  }

  /**
   * Attest a client-built auditor payload under the view key.
   * Server never invents balance — client supplies scoped disclosure.
   */
  attestAuditorProof(
    user: PublicAccount,
    viewKey: string,
    clientPayload: Record<string, unknown>
  ) {
    const stored = this.store.viewKeyCommitments?.[user.id];
    if (!stored) throw new Error("No view-key commitment on file");
    const expected = commit(viewKey, user.id);
    if (expected !== stored.commitment) throw new Error("Invalid view key");

    // Reject attempts to smuggle unrelated users
    if (
      clientPayload.userCommitment &&
      clientPayload.userCommitment !== user.credentialCommitment
    ) {
      throw new Error("Payload userCommitment mismatch");
    }

    const payload = {
      ...clientPayload,
      userCommitment: user.credentialCommitment,
      balanceCommitment: user.balanceCommitment,
      issuedAt: stored.issuedAt,
    };
    const sig = hmacSign(viewKey, JSON.stringify(payload));
    return {
      auditorProof: sha256(`${sig}|${stored.commitment}`),
      payload,
      legalBasis: "Selective disclosure under due legal process (§4 option 2)",
      note: "Class 0 fields in payload were supplied by the compelled device, not stored by the backend.",
    };
  }
}
