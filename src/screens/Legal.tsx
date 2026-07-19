type Props = {
  kind: "privacy" | "terms";
  onBack: () => void;
};

/** Minimal privacy / terms — required for pilot launch checklist, not legal advice. */
export function LegalScreen({ kind, onBack }: Props) {
  const title = kind === "privacy" ? "Privacy" : "Terms";
  return (
    <div className="screen settings fade-in">
      <header className="screen-head">
        <div>
          <h2>{title}</h2>
          <p>Circle pilot · Midnight confidential payments</p>
        </div>
      </header>
      <section className="settings__block">
        {kind === "privacy" ? (
          <>
            <p>
              Class 0 secrets (keys, openings, contacts, voice) stay on your device. The server
              stores commitments, nullifiers, and KYC registry leaves — not plaintext balances.
            </p>
            <p>
              Browser Web Speech may use cloud STT. Payment proofs use Compact + Midnight
              proof-server; witnesses for proving may include amounts. See COMPLIANCE.md.
            </p>
            <p>
              We do not sell personal data. Contact support for erasure requests subject to AML
              retention.
            </p>
          </>
        ) : (
          <>
            <p>
              Circle is a pilot product. CIRCLE units are product/testnet balances, not fiat
              deposits. Sandbox PSP and internal ledger are not licensed bank or UPI rails.
            </p>
            <p>
              You are responsible for recipients you pay. Disputes follow the in-app pilot refund
              flow. Midnight network fees (tDUST) may apply for optional on-chain broadcast.
            </p>
            <p>Not financial, legal, or investment advice. Confirm with counsel before real money.</p>
          </>
        )}
      </section>
      <button type="button" className="btn ghost" onClick={onBack}>
        Back
      </button>
    </div>
  );
}
