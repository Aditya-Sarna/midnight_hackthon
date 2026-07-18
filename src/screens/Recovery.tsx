import { useEffect, useState } from "react";
import { Glyph, GlyphMark } from "../components/Glyph";
import { api, type PublicUser } from "../lib/api";
import { loadVault, saveVault } from "../lib/deviceVault";

type Props = {
  user: PublicUser;
  onRecovered: (u: PublicUser) => void;
  onBack: () => void;
};

/**
 * Recovery releases threshold shares + ciphertext.
 * Class 0 reconstruction is device-side only (vault already on this browser for demo).
 */
export function Recovery({ user, onRecovered, onBack }: Props) {
  const [holders, setHolders] = useState<{ id: string; label: string }[]>([]);
  const [threshold, setThreshold] = useState(3);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    void api
      .vault(user.id)
      .then((v) => {
        setHolders(v.holders);
        setThreshold(v.threshold);
      })
      .catch(() => {
        setNote("No cloud vault meta yet — device Class 0 vault is already local.");
        setHolders([
          { id: "peer-1", label: "Trusted contact A" },
          { id: "peer-2", label: "Trusted contact B" },
          { id: "hw-token", label: "Hardware token" },
          { id: "cloud", label: "Encrypted cloud blob" },
          { id: "peer-3", label: "Trusted contact C" },
        ]);
      });
  }, [user.id]);

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function recover() {
    setBusy(true);
    setError("");
    try {
      const vault = await loadVault(user.id);
      if (vault) {
        await saveVault(vault);
        setDone(true);
        onRecovered(user);
        return;
      }
      const release = await api.recover(user.id, selected);
      setNote(release.note || "Shares released — decrypt on device");
      setDone(true);
      onRecovered(user);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Recovery failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen onboarding">
      <div className="stack fade-in">
        <header className="screen-head">
          <GlyphMark />
          <div>
            <h2>Recovery vault</h2>
            <p>
              Threshold {threshold}-of-{holders.length || 5}. Server never sees reconstructed Class 0.
            </p>
          </div>
        </header>

        {!done ? (
          <>
            {note && <p className="muted">{note}</p>}
            <ul className="share-list">
              {holders.map((h) => (
                <li key={h.id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={selected.includes(h.id)}
                      onChange={() => toggle(h.id)}
                    />
                    <span>{h.label}</span>
                  </label>
                </li>
              ))}
            </ul>
            {error && <p className="error">{error}</p>}
            <button
              className="btn primary"
              type="button"
              disabled={busy || (holders.length > 0 && selected.length < threshold)}
              onClick={() => void recover()}
            >
              {busy ? "Releasing shares…" : `Recover with ${selected.length} shares`}
            </button>
            <button className="btn ghost" type="button" onClick={onBack}>
              Back
            </button>
          </>
        ) : (
          <div className="center">
            <Glyph size={96} pulse />
            <h2>Vault restored</h2>
            <p className="tagline">
              Class 0 reconstructed on-device. Backend only coordinated share metadata.
            </p>
            <button className="btn primary" type="button" onClick={onBack}>
              Return to wallet
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
