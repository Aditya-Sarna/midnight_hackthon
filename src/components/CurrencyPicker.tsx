import { useEffect, useState } from "react";
import {
  CURRENCIES,
  getDisplayCurrency,
  setDisplayCurrency,
  type CurrencyCode,
} from "../lib/currency";

type Props = {
  compact?: boolean;
  className?: string;
};

export function CurrencyPicker({ compact = false, className = "" }: Props) {
  const [code, setCode] = useState<CurrencyCode>(() => getDisplayCurrency());

  useEffect(() => {
    const onChange = (e: Event) => setCode((e as CustomEvent<CurrencyCode>).detail);
    window.addEventListener("circled:currency", onChange);
    return () => window.removeEventListener("circled:currency", onChange);
  }, []);

  return (
    <label className={`currency-picker ${compact ? "currency-picker--compact" : ""} ${className}`}>
      {!compact && <span>Display currency</span>}
      <select
        value={code}
        aria-label="Display currency"
        onChange={(e) => {
          const next = e.target.value as CurrencyCode;
          setCode(next);
          setDisplayCurrency(next);
        }}
      >
        {CURRENCIES.map((c) => (
          <option key={c.code} value={c.code}>
            {c.code} · {c.label}
          </option>
        ))}
      </select>
    </label>
  );
}
