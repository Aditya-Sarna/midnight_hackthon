type Props = {
  proofMode?: string;
  proofServerOk?: boolean | null;
  lastSettleGrade?: string;
  onBack: () => void;
  onOpenTour?: () => void;
};

/**
 * One-screen judge brief: what is real vs demo, honest claims, FAQ.
 */
export function JudgeTruthPanel({
  proofMode = "—",
  proofServerOk = null,
  lastSettleGrade = "",
  onBack,
  onOpenTour,
}: Props) {
  const gold =
    proofMode === "midnight-proof-server" && proofServerOk === true;

  return (
    <div className="judge-truth fade-in" role="document" aria-label="Judge truth panel">
      <header className="judge-truth__head">
        <p className="atelier-kicker">Judge brief · honest claims</p>
        <h1 className="brand-mark">Circle</h1>
        <p>
          OTP replacement + private payment authorization on Midnight. Speak a payment; the device
          keeps balances private; Compact + proof-server verify the intent. Rails settle what the
          receiver accepts.
        </p>
        <p className="judge-truth__asset">
          <strong>Assets:</strong> CIRCLE product units (Class 0, on device) · sandbox INR → USD/BTC
          via Universal adapter API · tDUST only for optional Preprod fees — not licensed UPI/bank
          yet.
        </p>
      </header>

      <section className="judge-truth__status" aria-label="Live proof status">
        <h2>Live status</h2>
        <dl>
          <div>
            <dt>proofMode.mode</dt>
            <dd className={gold ? "is-gold" : ""}>{proofMode}</dd>
          </div>
          <div>
            <dt>proof-server</dt>
            <dd className={proofServerOk ? "is-gold" : "is-warn"}>
              {proofServerOk == null ? "—" : proofServerOk ? "ok" : "down"}
            </dd>
          </div>
          <div>
            <dt>last settle grade</dt>
            <dd className={lastSettleGrade === "zk-proved" ? "is-gold" : ""}>
              {lastSettleGrade || "none yet"}
            </dd>
          </div>
        </dl>
        {!gold && (
          <p className="judge-truth__warn">
            Gold path needs Docker proof-server. Run <code>npm run judge</code> for{" "}
            <strong>zk-proved</strong>. Strict production fails closed without it.
          </p>
        )}
      </section>

      <section className="judge-truth__cols">
        <div>
          <h2>Real (gold path)</h2>
          <ul>
            <li>Compiled Compact (<code>nyxpay.compact</code>) spend / session / credit circuits</li>
            <li>Midnight proof-server SNARKs when <code>proofServerOk</code></li>
            <li>Class 0 vault: keys, balance openings, contacts on device</li>
            <li>Public state: commitments, nullifiers — not plaintext amounts</li>
            <li>Circle session auth (OTP replacement via Compact)</li>
            <li>
              Universal adapter: backend <code>quote → route → settle</code> with route commitment +
              tamper reject
            </li>
          </ul>
        </div>
        <div>
          <h2>Demo / pilot (say so)</h2>
          <ul>
            <li>Chrome Web Speech may use cloud STT — not a private mic pipeline</li>
            <li>USD/BTC credits are sandbox rails — not licensed bank/UPI/mainnet</li>
            <li>“Add money” reseals product balance — not ACH</li>
            <li>KYC: sandbox / Onfido-shaped issuer — not live DigiLocker</li>
            <li>Preprod broadcast optional (wallet + contract env)</li>
            <li>Credit · merchant · strategy live under Circle → Settings</li>
          </ul>
        </div>
      </section>

      <section className="judge-truth__faq">
        <h2>Judge FAQ</h2>
        <details open>
          <summary>What’s the core idea?</summary>
          <p>
            We prove <em>authorized route intent</em> (who, how much, which quote/route/acceptance),
            then settle on the receiver’s preferred rail — not “INR on Midnight.”
          </p>
        </details>
        <details>
          <summary>Where is the money?</summary>
          <p>
            Class 0 CIRCLE balance on the device vault. Universal demo uses sandbox FX + bank/BTC
            adapters. Not a licensed fiat rail.
          </p>
        </details>
        <details>
          <summary>Who sees the amount?</summary>
          <p>
            Public ledger: no. Prover host: yes — Compact witnesses include amounts to produce
            SNARKs. Never claim “server never sees amounts.”
          </p>
        </details>
        <details>
          <summary>Tamper route?</summary>
          <p>
            After quote+route, swapping the route on settle fails with{" "}
            <code>route commitment mismatch</code>. Show it in Universal adapter.
          </p>
        </details>
        <details>
          <summary>Is voice fully private?</summary>
          <p>
            Payment secrets and proofs are local. Speech uses the browser Web Speech API (Chrome may
            send audio to Google).
          </p>
        </details>
      </section>

      <footer className="judge-truth__foot">
        <button type="button" className="btn primary" onClick={onBack}>
          Back to menu
        </button>
        {onOpenTour && (
          <button type="button" className="btn ghost" onClick={onOpenTour}>
            Start guided tour
          </button>
        )}
      </footer>
    </div>
  );
}
