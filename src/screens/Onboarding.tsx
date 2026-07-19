import { useEffect, useState, type FormEvent } from "react";
import { Glyph, GlyphMark } from "../components/Glyph";
import { saveSession, type PublicUser } from "../lib/api";
import { bootstrapProductAccount, bootstrapProductionDemo } from "../lib/bootstrap";
import { isDemoMode } from "../lib/productMode";
import { makeSystemsEvent, type SystemsEvent } from "../lib/systemsBus";

type Props = {
  onComplete: (user: PublicUser) => void;
  onShowZkDemo?: (user: PublicUser) => void;
  onSystemsEvent?: (e: SystemsEvent) => void;
};

/**
 * Product onboarding: government ID hashed on-device → register → wallet.
 * Showcase/demo path still seeds contacts when demo mode is on.
 */
export function Onboarding({ onComplete, onShowZkDemo, onSystemsEvent }: Props) {
  const [step, setStep] = useState<"welcome" | "govt-kyc" | "done">("welcome");
  const [displayName, setDisplayName] = useState("");
  const [aadhaar, setAadhaar] = useState("");
  const [recoveryPass, setRecoveryPass] = useState("");
  const [recoveryPass2, setRecoveryPass2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const demo = isDemoMode();

  useEffect(() => {
    if (step === "welcome") {
      onSystemsEvent?.(
        makeSystemsEvent({
          source: "onboarding",
          phase: "welcome",
          title: "Device vault path",
          detail: "Class 0 secrets never leave this device. Server will only store commitments.",
          layer: "device",
          status: "idle",
          intensity: 0.3,
        })
      );
    } else if (step === "govt-kyc") {
      onSystemsEvent?.(
        makeSystemsEvent({
          source: "onboarding",
          phase: "govt-kyc",
          title: "Hashing government ID",
          detail: "Document reference hashed on-device → KYC leaf · Merkle publish · vault seal.",
          layer: "kyc",
          status: "active",
          intensity: 0.65,
          circuits: ["prove_kyc_membership", "publish_kyc_leaf"],
        })
      );
    }
  }, [step, onSystemsEvent]);

  async function submitGovtKyc(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!aadhaar.trim()) {
      setError("Enter your government ID reference");
      return;
    }
    if (!demo && !displayName.trim()) {
      setError("Enter the name you want on Circle");
      return;
    }
    if (!demo) {
      if (recoveryPass.trim().length < 8) {
        setError("Recovery passphrase must be at least 8 characters");
        return;
      }
      if (recoveryPass !== recoveryPass2) {
        setError("Recovery passphrases do not match");
        return;
      }
    }
    setBusy(true);
    onSystemsEvent?.(
      makeSystemsEvent({
        source: "onboarding",
        phase: "issuing",
        title: "Issuing ZK-KYC + vault",
        detail: "Compact publish_kyc_leaf · credential commitment · recovery kit seal.",
        layer: "kyc",
        status: "proving",
        intensity: 0.95,
        circuits: ["publish_kyc_leaf", "prove_kyc_membership"],
      })
    );
    try {
      if (demo) {
        const result = await bootstrapProductionDemo({ documentRef: aadhaar.trim() });
        saveSession(result.user.id);
        setStep("done");
        onSystemsEvent?.(
          makeSystemsEvent({
            source: "onboarding",
            phase: "done",
            title: "KYC leaf on Midnight",
            detail: "Showcase vault ready — opening circuit walkthrough.",
            layer: "midnight",
            status: "settled",
            intensity: 0.5,
          })
        );
        if (onShowZkDemo) onShowZkDemo(result.user);
        else onComplete(result.user);
        return;
      }

      const result = await bootstrapProductAccount({
        displayName: displayName.trim(),
        documentRef: aadhaar.trim(),
        recoveryPassphrase: recoveryPass,
      });
      setStep("done");
      onSystemsEvent?.(
        makeSystemsEvent({
          source: "onboarding",
          phase: "done",
          title: "Account ready",
          detail: "KYC leaf published. Recovery kit downloaded — keep your passphrase safe.",
          layer: "midnight",
          status: "settled",
          intensity: 0.5,
        })
      );
      onComplete(result.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "KYC + vault provisioning failed");
      onSystemsEvent?.(
        makeSystemsEvent({
          source: "onboarding",
          phase: "error",
          title: "Onboarding failed",
          detail: err instanceof Error ? err.message : "KYC failed",
          layer: "kyc",
          status: "error",
          intensity: 0.4,
        })
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen onboarding">
      {step === "welcome" && (
        <div className="stack center fade-in">
          <Glyph size={120} pulse />
          <h1 className="brand">Circle</h1>
          <p className="tagline">
            Create your private wallet. Balances and amounts stay on this device — Midnight only
            verifies proofs.
          </p>
          <button className="btn primary" type="button" onClick={() => setStep("govt-kyc")}>
            Continue
          </button>
        </div>
      )}

      {step === "govt-kyc" && (
        <form className="stack fade-in" onSubmit={submitGovtKyc}>
          <header className="screen-head">
            <GlyphMark />
            <div>
              <h2>Verify & create vault</h2>
              <p>ID reference is hashed on-device — raw document never transmitted.</p>
            </div>
          </header>
          <div className="govt-badge">Authorized identity provider</div>
          {!demo && (
            <>
              <label>
                Display name
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="How you appear in Circle"
                  autoComplete="name"
                  required
                />
              </label>
              <label>
                Recovery passphrase
                <input
                  type="password"
                  value={recoveryPass}
                  onChange={(e) => setRecoveryPass(e.target.value)}
                  placeholder="Min 8 characters — keep this safe"
                  autoComplete="new-password"
                  required
                  minLength={8}
                />
              </label>
              <label>
                Confirm passphrase
                <input
                  type="password"
                  value={recoveryPass2}
                  onChange={(e) => setRecoveryPass2(e.target.value)}
                  placeholder="Repeat passphrase"
                  autoComplete="new-password"
                  required
                  minLength={8}
                />
              </label>
              <p className="muted" style={{ fontSize: "0.82rem" }}>
                We download a recovery kit file. With that file + this passphrase you can restore
                Circle on a new device. This is not a BIP39 seed phrase.
              </p>
            </>
          )}
          <label>
            Government ID reference
            <input
              value={aadhaar}
              onChange={(e) => setAadhaar(e.target.value)}
              placeholder="Aadhaar / DigiLocker ref"
              required
            />
          </label>
          {error && <p className="error">{error}</p>}
          <button className="btn primary" type="submit" disabled={busy}>
            {busy ? "Creating vault…" : "Verify & open wallet"}
          </button>
        </form>
      )}
    </div>
  );
}
