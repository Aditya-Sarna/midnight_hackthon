import { useEffect, useState } from "react";
import { Glyph, GlyphMark } from "../components/Glyph";
import { api, saveSession, type PublicUser } from "../lib/api";
import { loadVault, saveVault } from "../lib/deviceVault";
import { publicUserFromVault } from "../lib/offlineUser";
import { enrollCloudRecovery, recoveryBackupStatus } from "../lib/recoveryEnroll";
import {
  downloadRecoveryKit,
  isRecoveryKit,
  restoreFromRecoveryKit,
} from "../lib/recoveryKit";

type Props = {
  user: PublicUser;
  onRecovered: (u: PublicUser) => void;
  onBack: () => void;
};

/**
 * Social recovery + passphrase kit restore (cross-device).
 * Not a BIP39 seed phrase.
 */
export function Recovery({ user, onRecovered, onBack }: Props) {
  const [holders, setHolders] = useState<{ id: string; label: string }[]>([]);
  const [threshold, setThreshold] = useState(3);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [note, setNote] = useState("");
  const [localReady, setLocalReady] = useState<boolean | null>(null);
  const [enrolled, setEnrolled] = useState(false);
  const [kitText, setKitText] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [mode, setMode] = useState<"status" | "kit" | "shares">("status");

  useEffect(() => {
    void (async () => {
      const vault = await loadVault(user.id);
      setLocalReady(Boolean(vault));
      const status = await recoveryBackupStatus(user.id);
      setEnrolled(status.enrolled);
      if (status.enrolled && status.holders) {
        setHolders(status.holders);
        setThreshold(status.threshold ?? 3);
      }
      const localKit = localStorage.getItem(`circle_recovery_kit_${user.id}`);
      if (vault) {
        setNote(
          localKit
            ? "Vault is on this device. Re-download your kit anytime, or restore elsewhere with kit + passphrase."
            : "Vault is on this device. Enroll cloud backup if you have not already."
        );
        if (localKit) setKitText(localKit);
      } else {
        setNote("No local vault — restore with your recovery kit + passphrase (or threshold shares + kit).");
        setMode("kit");
      }
    })();
  }, [user.id]);

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function enroll() {
    setBusy(true);
    setError("");
    try {
      const localKit = localStorage.getItem(`circle_recovery_kit_${user.id}`);
      if (localKit) {
        const res = await fetch(`/api/users/${encodeURIComponent(user.id)}/vault/enroll`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vaultCiphertext: localKit }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Enroll failed");
      } else {
        const out = await enrollCloudRecovery(user.id);
        if (!out.ok) throw new Error(out.reason || "Enroll failed");
      }
      setEnrolled(true);
      const status = await recoveryBackupStatus(user.id);
      setHolders(status.holders ?? []);
      setThreshold(status.threshold ?? 3);
      setNote("Cloud backup enrolled.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Enroll failed");
    } finally {
      setBusy(false);
    }
  }

  async function restoreKit() {
    setBusy(true);
    setError("");
    try {
      let kit = kitText.trim();
      if (!kit && enrolled && selected.length >= threshold) {
        const release = await api.recover(user.id, selected);
        kit = String(release.clientCiphertext || "");
      }
      if (!isRecoveryKit(kit)) {
        throw new Error("Paste your Circle recovery kit (starts with circle-recovery-kit-v1:)");
      }
      if (passphrase.trim().length < 8) {
        throw new Error("Enter your recovery passphrase");
      }
      const { vault } = await restoreFromRecoveryKit(kit, passphrase);
      saveSession(vault.userId);
      setDone(true);
      setNote("Vault and keys restored on this device.");
      onRecovered(publicUserFromVault(vault));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Restore failed");
    } finally {
      setBusy(false);
    }
  }

  async function confirmLocal() {
    setBusy(true);
    setError("");
    try {
      const vault = await loadVault(user.id);
      if (!vault) throw new Error("No local vault");
      await saveVault(vault, { activate: true });
      setDone(true);
      setNote("Confirmed — Class 0 vault is active on this device.");
      onRecovered(user);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Confirm failed");
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
            <h2>Social recovery</h2>
            <p>
              Passphrase kit restores keys + balance on any device. Optional threshold cloud
              backup. Not a BIP39 seed.
            </p>
          </div>
        </header>

        {!done ? (
          <>
            {note && <p className="muted">{note}</p>}
            <p className="muted">
              Status: {localReady ? "local vault present" : "no local vault"}
              {" · "}
              {enrolled ? "cloud backup enrolled" : "cloud backup missing"}
            </p>

            <div className="pay-sheet__chips" role="group" aria-label="Recovery mode">
              <button
                type="button"
                className={`pay-sheet__chip${mode === "status" ? " is-active" : ""}`}
                onClick={() => setMode("status")}
              >
                This device
              </button>
              <button
                type="button"
                className={`pay-sheet__chip${mode === "kit" ? " is-active" : ""}`}
                onClick={() => setMode("kit")}
              >
                Kit + passphrase
              </button>
              {enrolled && (
                <button
                  type="button"
                  className={`pay-sheet__chip${mode === "shares" ? " is-active" : ""}`}
                  onClick={() => setMode("shares")}
                >
                  Threshold
                </button>
              )}
            </div>

            {mode === "status" && (
              <>
                {localReady && (
                  <button
                    className="btn primary"
                    type="button"
                    disabled={busy}
                    onClick={() => void confirmLocal()}
                  >
                    Confirm vault on this device
                  </button>
                )}
                {kitText && (
                  <button
                    className="btn ghost"
                    type="button"
                    onClick={() => downloadRecoveryKit(kitText, user.displayName)}
                  >
                    Re-download recovery kit
                  </button>
                )}
                {!enrolled && localReady && (
                  <button className="btn ghost" type="button" disabled={busy} onClick={() => void enroll()}>
                    Enroll cloud backup
                  </button>
                )}
              </>
            )}

            {(mode === "kit" || mode === "shares") && (
              <>
                {mode === "shares" && holders.length > 0 && (
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
                )}
                {mode === "kit" && (
                  <label>
                    Recovery kit
                    <textarea
                      value={kitText}
                      onChange={(e) => setKitText(e.target.value)}
                      rows={4}
                      placeholder="Paste circle-recovery-kit-v1:… or choose file"
                      style={{ width: "100%", fontFamily: "monospace", fontSize: "0.75rem" }}
                    />
                  </label>
                )}
                {mode === "kit" && (
                  <label className="btn ghost" style={{ display: "block", textAlign: "center" }}>
                    Choose kit file
                    <input
                      type="file"
                      accept=".txt,text/plain"
                      hidden
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        void f.text().then(setKitText);
                      }}
                    />
                  </label>
                )}
                <label>
                  Recovery passphrase
                  <input
                    type="password"
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    autoComplete="current-password"
                    placeholder="Passphrase from signup"
                  />
                </label>
                <button
                  className="btn primary"
                  type="button"
                  disabled={
                    busy ||
                    (mode === "shares" && selected.length < threshold) ||
                    (mode === "kit" && !kitText.trim())
                  }
                  onClick={() => void restoreKit()}
                >
                  {busy ? "Restoring…" : "Restore vault"}
                </button>
              </>
            )}

            {error && <p className="error">{error}</p>}
            <button className="btn ghost" type="button" onClick={onBack}>
              Back
            </button>
          </>
        ) : (
          <div className="center">
            <Glyph size={96} pulse />
            <h2>Vault ready</h2>
            <p className="tagline">{note || "Class 0 is active on this device."}</p>
            <button className="btn primary" type="button" onClick={onBack}>
              Return to wallet
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
