import { useState } from "react";
import { Glyph } from "./Glyph";
import { saveSession, type PublicUser } from "../lib/api";
import { publicUserFromVault } from "../lib/offlineUser";
import { disableDemoMode } from "../lib/productMode";
import { isRecoveryKit, restoreFromRecoveryKit } from "../lib/recoveryKit";

type Props = {
  backendOk: boolean | null;
  onCreateAccount: () => void;
  onBackToMenu?: () => void;
  onRestored?: (user: PublicUser) => void;
};

export function ProductGate({
  backendOk,
  onCreateAccount,
  onBackToMenu,
  onRestored,
}: Props) {
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [kitText, setKitText] = useState("");
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function restore() {
    setBusy(true);
    setError("");
    try {
      if (!isRecoveryKit(kitText)) {
        throw new Error("Paste a Circle recovery kit file");
      }
      const { vault } = await restoreFromRecoveryKit(kitText, pass);
      saveSession(vault.userId);
      disableDemoMode();
      onRestored?.(publicUserFromVault(vault));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Restore failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="product-gate">
      <div className="product-gate__glow" aria-hidden />
      <div className="product-gate__card fade-in">
        <Glyph size={96} pulse />
        <h1 className="brand-mark product-gate__brand">Circle</h1>
        <p className="product-gate__tag">
          Confidential voice payments on Midnight. Balances stay on your device; the public ledger
          only sees proofs. Browser speech may use cloud STT — payment secrets do not.
        </p>

        {backendOk === false && (
          <p className="error product-gate__warn">
            Backend unreachable. You can still restore a recovery kit offline; create account needs
            the API.
          </p>
        )}

        {!restoreOpen ? (
          <div className="product-gate__actions">
            <button
              type="button"
              className="btn primary"
              disabled={backendOk === false}
              onClick={() => {
                disableDemoMode();
                onCreateAccount();
              }}
            >
              Create account
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                setRestoreOpen(true);
                setError("");
              }}
            >
              Restore from recovery kit
            </button>
            {onBackToMenu && (
              <button type="button" className="btn ghost" onClick={onBackToMenu}>
                Back to menu
              </button>
            )}
          </div>
        ) : (
          <div className="product-gate__actions" style={{ textAlign: "left" }}>
            <label>
              Recovery kit
              <textarea
                value={kitText}
                onChange={(e) => setKitText(e.target.value)}
                rows={3}
                placeholder="circle-recovery-kit-v1:…"
                style={{ width: "100%", fontFamily: "monospace", fontSize: "0.75rem" }}
              />
            </label>
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
            <label>
              Passphrase
              <input
                type="password"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                autoComplete="current-password"
              />
            </label>
            {error && <p className="error">{error}</p>}
            <button
              type="button"
              className="btn primary"
              disabled={busy}
              onClick={() => void restore()}
            >
              {busy ? "Restoring…" : "Restore wallet"}
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={() => setRestoreOpen(false)}
            >
              Cancel
            </button>
          </div>
        )}

        <ul className="product-gate__points">
          <li>Recovery kit + passphrase restores keys on a new device</li>
          <li>Speak a payment from the home-screen widget — ZK proof before settlement</li>
          <li>Contacts, history, and balance stay local</li>
        </ul>
      </div>
    </div>
  );
}
