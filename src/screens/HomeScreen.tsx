import { useMemo, useState } from "react";
import type { DeviceVaultState } from "../lib/deviceVault";
import { formatMoney, getDisplayCurrency } from "../lib/currency";
import { fundWallet } from "../lib/fund";
import { CurrencyPicker } from "../components/CurrencyPicker";
import { SpendingInsights } from "./SpendingInsights";

type Props = {
  onOpenCircle: () => void;
  onOpenContacts?: () => void;
  onOpenSettings?: () => void;
  onPay: () => void;
  proving?: boolean;
  listening?: boolean;
  voiceHint?: string;
  vault?: DeviceVaultState | null;
  onVaultChange?: (v: DeviceVaultState) => void;
  backendOk?: boolean | null;
};

const APPS: { name: string; hue: string }[] = [
  { name: "Phone", hue: "#34c759" },
  { name: "Mail", hue: "#3a3a3c" },
  { name: "Safari", hue: "#5ac8fa" },
  { name: "Music", hue: "#ff2d55" },
  { name: "Maps", hue: "#64d2ff" },
  { name: "Messages", hue: "#30d158" },
  { name: "Photos", hue: "#ff9f0a" },
  { name: "Camera", hue: "#8e8e93" },
];

export function HomeScreen({
  onOpenCircle,
  onOpenContacts,
  onOpenSettings,
  onPay,
  proving,
  listening,
  voiceHint = "Tap to speak — amount and name",
  vault = null,
  onVaultChange,
  backendOk = true,
}: Props) {
  const [insightsOn, setInsightsOn] = useState(false);
  const [fundOpen, setFundOpen] = useState(false);
  const [fundBusy, setFundBusy] = useState(false);
  const [fundErr, setFundErr] = useState("");
  const currency = getDisplayCurrency();
  const clock = useMemo(() => {
    const d = new Date();
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }, []);

  const recent = useMemo(() => {
    const list = [...(vault?.paymentHistory ?? [])];
    list.sort((a, b) => b.timestamp - a.timestamp);
    return list.slice(0, 3);
  }, [vault?.paymentHistory]);

  const balanceLabel = vault ? formatMoney(vault.balance, currency) : "—";
  const statusLine = listening
    ? "I’m listening…"
    : proving
      ? "Working on it…"
      : backendOk === false
        ? "Offline — balance on device"
        : voiceHint;

  async function addMoney(amount: number) {
    if (!vault || !onVaultChange) return;
    setFundBusy(true);
    setFundErr("");
    try {
      const next = await fundWallet(vault, amount);
      onVaultChange(next);
      setFundOpen(false);
    } catch (e) {
      setFundErr(e instanceof Error ? e.message : "Could not add money");
    } finally {
      setFundBusy(false);
    }
  }

  return (
    <div className="home">
      <div className="home__status">
        <span>{clock}</span>
        <span className="home__status-right">
          {onOpenSettings ? (
            <button type="button" className="home__settings-link" onClick={onOpenSettings}>
              Settings
            </button>
          ) : (
            "5G · ▮▮▮"
          )}
        </span>
      </div>

      <div className="home__wallpaper" aria-hidden />

      <div
        className={`circled-widget circled-widget--money ${proving || listening ? "circled-widget--live" : ""} ${
          insightsOn ? "circled-widget--insights" : ""
        }`}
      >
        <span className="circled-widget__flow" aria-hidden />
        <span className="circled-widget__flow circled-widget__flow--2" aria-hidden />

        <button
          type="button"
          className="circled-widget__pay"
          onClick={onPay}
          onDoubleClick={onOpenCircle}
          aria-label="Circle — tap to speak a payment"
        >
          <span className="circled-widget__glyph-wrap">
            <img src="/glyph.png" alt="" className="circled-widget__glyph" />
          </span>
          <span className="circled-widget__meta">
            <strong className="brand-mark">Circle</strong>
            <span className="circled-widget__balance">{balanceLabel}</span>
            <em aria-live="polite">{statusLine}</em>
            <span className="circled-widget__activity" aria-label="Recent payments">
              {recent.length === 0 ? (
                <span className="circled-widget__activity-empty">
                  {vault && vault.balance <= 0 ? "Add money to start paying" : "No payments yet"}
                </span>
              ) : (
                recent.map((p) => (
                  <span key={p.id} className="circled-widget__activity-row">
                    <span className="circled-widget__activity-name">{p.recipient}</span>
                    <span className="circled-widget__activity-amt">
                      {p.direction === "out" ? "−" : "+"}
                      {formatMoney(p.amount, currency)}
                    </span>
                  </span>
                ))
              )}
            </span>
          </span>
        </button>

        <label
          className={`circled-widget__toggle ${!vault ? "circled-widget__toggle--off" : ""}`}
          title="Budgeting & spending insights"
        >
          <input
            type="checkbox"
            checked={insightsOn}
            disabled={!vault}
            onChange={(e) => setInsightsOn(e.target.checked)}
            aria-label="Open spending insights"
          />
          <span className="circled-widget__switch" aria-hidden>
            <i />
          </span>
          <em>Insights</em>
        </label>
      </div>

      <div className="home__grid">
        {APPS.map((app) => (
          <div key={app.name} className="home-icon" aria-hidden>
            <span className="home-icon__tile" style={{ background: app.hue }} />
            <span className="home-icon__label">{app.name}</span>
          </div>
        ))}
      </div>

      <div className="home__dock">
        <span className="home-icon__tile" style={{ background: "#34c759" }} />
        <span className="home-icon__tile" style={{ background: "#1c1c1e" }} />
        <span className="home-icon__tile" style={{ background: "#5ac8fa" }} />
        <button
          type="button"
          className="circled-dock"
          onClick={onOpenCircle}
          aria-label="Open Circle type-to-pay"
          title="Type a payment"
        >
          <span className="circled-dock__flow" aria-hidden />
          <img src="/glyph.png" alt="" />
        </button>
      </div>

      <div className="home__currency">
        <CurrencyPicker compact />
      </div>

      <div className="home__actions-row">
        {vault && onVaultChange && (
          <button
            type="button"
            className="home__fund-btn"
            disabled={backendOk === false}
            onClick={() => {
              setFundErr("");
              setFundOpen(true);
            }}
          >
            Add money
          </button>
        )}
        {onOpenContacts && (
          <button type="button" className="home__contacts-btn" onClick={onOpenContacts}>
            Contacts · {vault?.contacts?.length ?? 0}
          </button>
        )}
      </div>

      <p className="home__hint">
        {listening
          ? "Say amount and name"
          : backendOk === false
            ? "Backend offline — you can view balance; pay when systems are live"
            : "Pay from the widget — no app open needed"}
      </p>

      {fundOpen && (
        <div className="home-fund" role="dialog" aria-label="Add money">
          <div className="home-fund__card">
            <h3>Add money</h3>
            <p>Top up your on-device Circle balance (testnet product rail).</p>
            <div className="home-fund__presets">
              {[1_000, 5_000, 10_000, 25_000].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  className="btn ghost"
                  disabled={fundBusy}
                  onClick={() => void addMoney(amt)}
                >
                  {formatMoney(amt, currency)}
                </button>
              ))}
            </div>
            {fundErr && <p className="error">{fundErr}</p>}
            <button
              type="button"
              className="btn ghost"
              disabled={fundBusy}
              onClick={() => setFundOpen(false)}
            >
              {fundBusy ? "Adding…" : "Cancel"}
            </button>
          </div>
        </div>
      )}

      {insightsOn && vault && onVaultChange && (
        <SpendingInsights
          vault={vault}
          onVaultChange={onVaultChange}
          onClose={() => setInsightsOn(false)}
        />
      )}
    </div>
  );
}
