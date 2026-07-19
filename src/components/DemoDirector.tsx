import { useEffect, useRef, useState } from "react";
import { saveSession, type PublicUser } from "../lib/api";
import { bootstrapProductionDemo } from "../lib/bootstrap";
import { deviceId } from "../lib/api";

type Props = {
  onReady: (user: PublicUser, mode: "tour" | "explore") => void;
  onManual: () => void;
  /** Auto-start a mode when arriving from the main menu */
  autoLaunch?: "tour" | "explore" | null;
};

const BEATS = [
  { roman: "I", label: "Device Class 0 vault", hint: "Keys · balance · policy" },
  { roman: "II", label: "Sandbox ZK-KYC", hint: "Commitment · not live DigiLocker" },
  { roman: "III", label: "Compact + Midnight", hint: "Proof-server SNARKs" },
  { roman: "IV", label: "Voice pay demo", hint: "Session auth · spend proof" },
  { roman: "V", label: "Recovery kit", hint: "Passphrase · no plaintext on server" },
];

/** One-click production demonstration launcher — cinema atelier */
export function DemoDirector({ onReady, onManual, autoLaunch = null }: Props) {
  const [busy, setBusy] = useState(false);
  const [beat, setBeat] = useState(-1);
  const [error, setError] = useState("");
  const autoRef = useRef(false);

  async function launch(mode: "tour" | "explore") {
    setBusy(true);
    setError("");
    setBeat(0);
    try {
      for (let i = 0; i < BEATS.length; i++) {
        setBeat(i);
        await new Promise((r) => setTimeout(r, 280));
      }
      deviceId();
      const result = await bootstrapProductionDemo();
      saveSession(result.user.id);
      setBeat(BEATS.length);
      await new Promise((r) => setTimeout(r, 280));
      onReady(result.user, mode);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Demo bootstrap failed");
      setBusy(false);
      setBeat(-1);
    }
  }

  useEffect(() => {
    if (!autoLaunch || autoRef.current) return;
    autoRef.current = true;
    void launch(autoLaunch);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot from menu
  }, [autoLaunch]);

  return (
    <div className="director atelier-panel">
      <header className="director__head">
        <img src="/glyph.png" alt="" className="director__glyph" />
        <p className="atelier-kicker">Guided tour</p>
        <h1 className="brand-mark">Circle</h1>
        <p className="director__pitch">
          Provisions a demo vault, then walks voice pay to a zk-proved settle. For INR → USD/BTC
          routing, use Universal adapter from the menu.
        </p>
      </header>

      <ul className="director__beats">
        {BEATS.map((b, i) => (
          <li key={b.roman} className={i <= beat ? "on" : ""} style={{ ["--i" as string]: String(i) }}>
            <span className="director__roman">{b.roman}</span>
            <span className="director__beat-copy">
              <strong>{b.label}</strong>
              <em>{b.hint}</em>
            </span>
            <span className="director__rule" aria-hidden />
          </li>
        ))}
      </ul>

      {error && <p className="error">{error}</p>}

      <div className="director__actions">
        <button
          className="btn primary director__cta"
          type="button"
          disabled={busy}
          onClick={() => void launch("tour")}
        >
          {busy ? "Provisioning Class 0 vault…" : "Start guided judge tour"}
        </button>
        <button
          className="btn ghost"
          type="button"
          disabled={busy}
          onClick={() => void launch("explore")}
        >
          Launch without guide
        </button>
        <button className="btn ghost" type="button" disabled={busy} onClick={onManual}>
          Manual setup — KYC then signup
        </button>
      </div>

      <p className="director__foot">Pilot-ready · Midnight confidential payments</p>
    </div>
  );
}
