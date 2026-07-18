import { useEffect, useState, type FormEvent } from "react";
import { Glyph, GlyphMark } from "../components/Glyph";
import { saveSession, type PublicUser } from "../lib/api";
import { bootstrapProductionDemo } from "../lib/bootstrap";
import { makeSystemsEvent, type SystemsEvent } from "../lib/systemsBus";

type Props = {
  onComplete: (user: PublicUser) => void;
  onShowZkDemo: (user: PublicUser) => void;
  onSystemsEvent?: (e: SystemsEvent) => void;
};

/**
 * Manual onboarding collapses to the same Class 0 device-vault path as the
 * production demo — government ID is hashed on-device before register.
 */
export function Onboarding({ onComplete: _onComplete, onShowZkDemo, onSystemsEvent }: Props) {
  const [step, setStep] = useState<"welcome" | "govt-kyc" | "done">("welcome");
  const [aadhaar, setAadhaar] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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
    setBusy(true);
    onSystemsEvent?.(
      makeSystemsEvent({
        source: "onboarding",
        phase: "issuing",
        title: "Issuing ZK-KYC + vault",
        detail: "Compact publish_kyc_leaf · credential commitment · AES-GCM vault wrap.",
        layer: "kyc",
        status: "proving",
        intensity: 0.95,
        circuits: ["publish_kyc_leaf", "prove_kyc_membership"],
      })
    );
    try {
      // Document reference is hashed inside bootstrap/register — never stored raw
      const result = await bootstrapProductionDemo({ documentRef: aadhaar.trim() });
      saveSession(result.user.id);
      setStep("done");
      onSystemsEvent?.(
        makeSystemsEvent({
          source: "onboarding",
          phase: "done",
          title: "KYC leaf on Midnight",
          detail: "Registry root updated. Class 0 vault ready. Moving to circuit triptych.",
          layer: "midnight",
          status: "settled",
          intensity: 0.5,
        })
      );
      onShowZkDemo(result.user);
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
          <h1 className="brand">Circled</h1>
          <p className="tagline">
            Class 0 secrets stay on this device. The server only ever receives commitments.
          </p>
          <button className="btn primary" type="button" onClick={() => setStep("govt-kyc")}>
            Start with government KYC
          </button>
        </div>
      )}

      {step === "govt-kyc" && (
        <form className="stack fade-in" onSubmit={submitGovtKyc}>
          <header className="screen-head">
            <GlyphMark />
            <div>
              <h2>Government KYC</h2>
              <p>ID reference is hashed on-device — raw document never transmitted.</p>
            </div>
          </header>
          <div className="govt-badge">Authorized identity provider</div>
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
            {busy ? "Issuing commitment…" : "Verify & create device vault"}
          </button>
        </form>
      )}
    </div>
  );
}
