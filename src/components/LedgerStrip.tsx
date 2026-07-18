import { useEffect, useState } from "react";
import { api } from "../lib/api";

export function LedgerStrip() {
  const [ledger, setLedger] = useState<Awaited<ReturnType<typeof api.ledger>> | null>(null);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const data = await api.ledger();
        if (alive) setLedger(data);
      } catch {
        /* backend may be starting */
      }
    };
    tick();
    const id = setInterval(tick, 2000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  if (!ledger) {
    return (
      <aside className="ledger">
        <h2>Midnight ledger</h2>
        <p className="muted">Connecting…</p>
      </aside>
    );
  }

  return (
    <aside className="ledger">
      <h2>Midnight ledger</h2>
      <p className="ledger__root">
        KYC root <code>{ledger.kycRegistryRoot.slice(0, 18)}…</code>
      </p>
      <div className="ledger__stats">
        <span>nullifiers {ledger.spentNullifierCount}</span>
        <span>relay queue {ledger.pendingInRelay}</span>
      </div>
      <ul className="ledger__events">
        {ledger.events.length === 0 && <li className="muted">No released events</li>}
        {ledger.events.map((e) => (
          <li key={e.id}>
            <strong>{e.type}</strong>
            <span>{new Date(e.timestamp).toLocaleTimeString()}</span>
            {e.note && <em>{e.note}</em>}
          </li>
        ))}
      </ul>
    </aside>
  );
}
