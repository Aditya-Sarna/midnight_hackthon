import { useMemo, useState } from "react";
import type { DeviceVaultState } from "../lib/deviceVault";
import { CurrencyPicker } from "../components/CurrencyPicker";
import { SpendingInsights } from "./SpendingInsights";

type Props = {
  onOpenCircled: () => void;
  onOpenContacts?: () => void;
  onPay: () => void;
  proving?: boolean;
  listening?: boolean;
  voiceHint?: string;
  vault?: DeviceVaultState | null;
  onVaultChange?: (v: DeviceVaultState) => void;
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
  onOpenCircled,
  onOpenContacts,
  onPay,
  proving,
  listening,
  voiceHint = "Tap card · say amount and name",
  vault = null,
  onVaultChange,
}: Props) {
  const [insightsOn, setInsightsOn] = useState(false);
  const clock = useMemo(() => {
    const d = new Date();
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }, []);

  return (
    <div className="home">
      <div className="home__status">
        <span>{clock}</span>
        <span className="home__status-right">5G · ▮▮▮</span>
      </div>

      <div className="home__wallpaper" aria-hidden />

      <div
        className={`circled-widget ${proving || listening ? "circled-widget--live" : ""} ${
          insightsOn ? "circled-widget--insights" : ""
        }`}
      >
        <span className="circled-widget__flow" aria-hidden />
        <span className="circled-widget__flow circled-widget__flow--2" aria-hidden />

        <button
          type="button"
          className="circled-widget__pay"
          onClick={onPay}
          onDoubleClick={onOpenCircled}
          aria-label="Circled — tap to speak a payment"
        >
          <span className="circled-widget__glyph-wrap">
            <img src="/glyph.png" alt="" className="circled-widget__glyph" />
          </span>
          <span className="circled-widget__meta">
            <strong className="brand-mark">Circled</strong>
            <em aria-live="polite">
              {listening ? "Listening…" : proving ? "Verifying…" : "Tap to speak"}
            </em>
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
          onClick={onOpenCircled}
          aria-label="Open Circled type-to-pay"
          title="Type a payment"
        >
          <span className="circled-dock__flow" aria-hidden />
          <img src="/glyph.png" alt="" />
        </button>
      </div>

      <div className="home__currency">
        <CurrencyPicker compact />
      </div>

      {onOpenContacts && (
        <button type="button" className="home__contacts-btn" onClick={onOpenContacts}>
          Contacts · {vault?.contacts?.length ?? 0} on device
        </button>
      )}

      <p className="home__hint">{listening ? "Say amount and name" : voiceHint}</p>

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
