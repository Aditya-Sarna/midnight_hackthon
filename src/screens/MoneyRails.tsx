import { useEffect, useState } from "react";
import { GlyphMark } from "../components/Glyph";
import { ASSET } from "../lib/assetModel";
import { fundWallet } from "../lib/fund";
import { requestOfframp } from "../lib/offramp";
import { formatMoney, getDisplayCurrency } from "../lib/currency";
import type { DeviceVaultState } from "../lib/deviceVault";

type Rail = {
  id: string;
  label: string;
  direction: string;
  readiness: string;
  note: string;
};

type Props = {
  vault: DeviceVaultState | null;
  onVaultChange?: (v: DeviceVaultState) => void;
  onBack: () => void;
};

export function MoneyRailsScreen({ vault, onVaultChange, onBack }: Props) {
  const [rails, setRails] = useState<Rail[]>([]);
  const [oneLiner, setOneLiner] = useState(ASSET.oneLiner);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [accountHint, setAccountHint] = useState("****1234");
  const currency = getDisplayCurrency();

  useEffect(() => {
    void fetch("/api/rails")
      .then((r) => r.json())
      .then((d) => {
        setRails(d.rails ?? []);
        if (d.asset?.oneLiner) setOneLiner(d.asset.oneLiner);
      })
      .catch(() => setRails([]));
  }, []);

  async function topUp(amount: number) {
    if (!vault || !onVaultChange) return;
    setBusy(true);
    setMsg("");
    try {
      const next = await fundWallet(vault, amount);
      onVaultChange(next);
      setMsg(`Added ${formatMoney(amount, currency)} CIRCLE units`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Top-up failed");
    } finally {
      setBusy(false);
    }
  }

  async function withdraw() {
    if (!vault) return;
    const amount = Math.min(1000, vault.balance);
    if (amount <= 0) {
      setMsg("Add money before off-ramp");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const out = await requestOfframp({
        amount,
        currency: ASSET.symbol,
        accountHint,
      });
      setMsg(
        `${out.status} · ${out.reference} · Pilot offramp stub. For webhook-complete lifecycle use sandbox_psp rail (not a licensed bank).`
      );
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Off-ramp failed");
    } finally {
      setBusy(false);
    }
  }

  async function sandboxPspSmoke() {
    setBusy(true);
    setMsg("");
    try {
      const quoteRes = await fetch("/api/rails");
      const hub = await quoteRes.json();
      const has = (hub.rails ?? []).some((r: { id: string }) => r.id === "sandbox_psp");
      if (!has) throw new Error("sandbox_psp not registered");
      setMsg(
        "sandbox_psp ready — quote/reserve/settle/refund + HMAC webhook at POST /api/rails/sandbox_psp/webhook (pilot, not licensed UPI/bank)"
      );
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "sandbox_psp check failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen fade-in">
      <header className="screen-head">
        <GlyphMark />
        <div>
          <h2>Money rails</h2>
          <p>{ASSET.name}</p>
        </div>
      </header>

      <p className="muted" style={{ fontSize: "0.85rem", lineHeight: 1.45 }}>
        {oneLiner}
      </p>

      <p>
        Balance:{" "}
        <strong>{vault ? formatMoney(vault.balance, currency) : "—"}</strong>{" "}
        <span className="muted">{ASSET.symbol}</span>
      </p>

      <section className="settings__block">
        <h3>Deposit (pilot)</h3>
        <div className="home-fund__presets">
          {[1_000, 5_000, 10_000].map((amt) => (
            <button
              key={amt}
              type="button"
              className="btn ghost"
              disabled={busy || !vault}
              onClick={() => void topUp(amt)}
            >
              +{formatMoney(amt, currency)}
            </button>
          ))}
        </div>
      </section>

      <section className="settings__block">
        <h3>Sandbox PSP (pilot contract)</h3>
        <p className="muted" style={{ fontSize: "0.85rem" }}>
          Webhook-complete lifecycle — not a licensed UPI/bank/card rail.
        </p>
        <button
          type="button"
          className="btn ghost"
          disabled={busy}
          onClick={() => void sandboxPspSmoke()}
        >
          Check sandbox_psp readiness
        </button>
      </section>

      <section className="settings__block">
        <h3>Withdraw (stub)</h3>
        <label>
          Account hint
          <input value={accountHint} onChange={(e) => setAccountHint(e.target.value)} />
        </label>
        <button type="button" className="btn ghost" disabled={busy} onClick={() => void withdraw()}>
          Off-ramp stub (mock bank)
        </button>
      </section>

      <section className="settings__block">
        <h3>Registered rails</h3>
        <ul className="share-list">
          {rails.map((r) => (
            <li key={r.id}>
              <strong>{r.label}</strong>
              <span className="muted">
                {" "}
                · {r.readiness} · {r.direction}
              </span>
              <div className="muted" style={{ fontSize: "0.78rem" }}>
                {r.note}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {msg && <p className="muted">{msg}</p>}
      <button type="button" className="btn ghost" onClick={onBack}>
        Back
      </button>
    </div>
  );
}
