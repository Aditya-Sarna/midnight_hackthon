/**
 * Proof Verification Service (§1)
 * Touches: proofs, public commitments, nullifiers
 * Must NOT touch: balances, amounts, addresses, policy contents
 *
 * Commitments (Class 1) are allowed in publicInputs. Plaintext private
 * witnesses are not — those would be a compliance regression.
 */
export class ProofVerificationService {
  verify(bundle: {
    recipientProof?: { verified?: boolean; proof?: string; publicInputs?: Record<string, string> };
    policyProof?: { verified?: boolean; proof?: string; publicInputs?: Record<string, string> };
    spendProof?: { verified?: boolean; proof?: string; publicInputs?: Record<string, string> };
    nullifier?: string;
    spentNullifiers: string[];
  }): { ok: boolean; reason?: string; publicOnly: true } {
    // Structural check — never decrypts private witnesses
    const proofs = [
      { proof: bundle.recipientProof, kind: "recipient" },
      { proof: bundle.policyProof, kind: "policy" },
      { proof: bundle.spendProof, kind: "spend" },
    ].filter((entry) => Boolean(entry.proof));
    for (const p of proofs) {
      if (!p.proof?.proof && !p.proof?.verified) {
        return { ok: false, reason: "Missing proof object", publicOnly: true };
      }
      // Reject plaintext private fields — commitments / digests / roots are Class 1 OK
      for (const [k, v] of Object.entries(p.proof?.publicInputs ?? {})) {
        const key = k.toLowerCase();
        const isCommitmentOrDigest =
          /commitment|digest|root|nullifier|membership|bound|contract|template/.test(key);
        if (isCommitmentOrDigest) continue;
        if (/^(balance|amount|address|name|policy_param|plaintext)/i.test(key)) {
          return {
            ok: false,
            reason: `Compliance regression: private field "${k}" in publicInputs`,
            publicOnly: true,
          };
        }
        // Heuristic: numeric-looking "amount" values must not appear unlabeled
        if (/amount|balance|address/i.test(key) && !/commit|hash|digest|root/i.test(key)) {
          return {
            ok: false,
            reason: `Compliance regression: private field "${k}" (=${String(v).slice(0, 12)}) in publicInputs`,
            publicOnly: true,
          };
        }
      }
    }
    if (bundle.nullifier && bundle.spentNullifiers.includes(bundle.nullifier)) {
      return { ok: false, reason: "Nullifier already spent", publicOnly: true };
    }
    return { ok: true, publicOnly: true };
  }
}
