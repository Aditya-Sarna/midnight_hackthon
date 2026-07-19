import { useState } from "react";
import type { PublicUser } from "../lib/api";
import type { DeviceVaultState } from "../lib/deviceVault";
import { formatMoney, getDisplayCurrency } from "../lib/currency";
import { enableDemoMode } from "../lib/productMode";
import {
  hasWebauthnCredential,
  registerVaultPasskey,
  webauthnAvailable,
} from "../lib/webauthnVault";
import { GlyphMark } from "../components/Glyph";

type Props = {
  user: PublicUser;
  vault: DeviceVaultState | null;
  onBack: () => void;
  onRecovery: () => void;
  onStrategy: () => void;
  onCredit: () => void;
  onMerchant: () => void;
  onMoneyRails?: () => void;
  onOpenShowcase: () => void;
  onPrivacy?: () => void;
  onTerms?: () => void;
  onSignOut: () => void;
};

export function SettingsScreen({
  user,
  vault,
  onBack,
  onRecovery,
  onStrategy,
  onCredit,
  onMerchant,
  onMoneyRails,
  onOpenShowcase,
  onPrivacy,
  onTerms,
  onSignOut,
}: Props) {
  const [passkeyMsg, setPasskeyMsg] = useState("");
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const enrolled = hasWebauthnCredential();

  async function enrollPasskey() {
    setPasskeyBusy(true);
    setPasskeyMsg("");
    try {
      if (!webauthnAvailable()) {
        setPasskeyMsg("Passkeys not available in this browser");
        return;
      }
      const ok = await registerVaultPasskey(user.id, user.displayName || "Circle");
      setPasskeyMsg(ok ? "Vault passkey enrolled — high-value pays will require biometrics" : "Enrollment cancelled");
    } catch (e) {
      setPasskeyMsg(e instanceof Error ? e.message : "Could not enroll passkey");
    } finally {
      setPasskeyBusy(false);
    }
  }

  return (
    <div className="screen settings fade-in">
      <header className="screen-head">
        <GlyphMark />
        <div>
          <h2>Settings</h2>
          <p>{user.displayName || "Your Circle account"}</p>
        </div>
      </header>

      <section className="settings__block">
        <h3>Account</h3>
        <dl className="settings__meta">
          <div>
            <dt>User id</dt>
            <dd className="mono">{user.id.slice(0, 12)}…</dd>
          </div>
          <div>
            <dt>Balance (device)</dt>
            <dd>{vault ? formatMoney(vault.balance, getDisplayCurrency()) : "—"}</dd>
          </div>
          <div>
            <dt>Contacts</dt>
            <dd>{vault?.contacts?.length ?? 0} on device</dd>
          </div>
        </dl>
      </section>

      <section className="settings__block">
        <h3>Security & money</h3>
        <button
          type="button"
          className="settings__row"
          disabled={passkeyBusy}
          onClick={() => void enrollPasskey()}
        >
          {enrolled ? "Vault passkey enrolled" : "Enroll vault passkey"}
          <span>
            {enrolled
              ? "Touch ID / Face ID required for high-value payments (>500)"
              : "Biometric unlock for high-value pays — enroll once on this device"}
          </span>
        </button>
        {passkeyMsg && <p className="settings__hint">{passkeyMsg}</p>}
        <button type="button" className="settings__row" onClick={onRecovery}>
          Social recovery
          <span>Passphrase kit + optional threshold backup — not a BIP39 seed</span>
        </button>
        <button type="button" className="settings__row" onClick={onStrategy}>
          Strategy commitment
          <span>Private params → public commitment + Compact proof</span>
        </button>
        <button type="button" className="settings__row" onClick={onCredit}>
          Circle Credit
          <span>Overcollateralized pool · Compact credit circuits</span>
        </button>
        <button type="button" className="settings__row" onClick={onMerchant}>
          Merchant receive
          <span>Opaque inbound destination · QR · sandbox off-ramp</span>
        </button>
        {onMoneyRails && (
          <button type="button" className="settings__row" onClick={onMoneyRails}>
            Money rails & asset
            <span>CIRCLE units · sandbox_psp · rail readiness</span>
          </button>
        )}
      </section>

      <section className="settings__block">
        <h3>App</h3>
        {onPrivacy && (
          <button type="button" className="settings__row" onClick={onPrivacy}>
            Privacy
            <span>Class 0 on-device · commitments on ledger · rails convert sandbox</span>
          </button>
        )}
        {onTerms && (
          <button type="button" className="settings__row" onClick={onTerms}>
            Terms
            <span>Pilot CIRCLE units · sandbox FX · not licensed bank/UPI</span>
          </button>
        )}
        <button
          type="button"
          className="settings__row"
          onClick={() => {
            enableDemoMode();
            onOpenShowcase();
          }}
        >
          Back to menu
          <span>Real vs demo · Universal · Guided tour</span>
        </button>
        <button type="button" className="settings__row settings__row--danger" onClick={onSignOut}>
          Sign out
          <span>Clear session and local vaults on this browser</span>
        </button>
      </section>

      <button type="button" className="btn ghost" onClick={onBack}>
        Back to wallet
      </button>
    </div>
  );
}
