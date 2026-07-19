import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import {
  LAYER_LABEL,
  type LiveProofLite,
  type SystemsEvent,
  type SystemsLayer,
} from "../lib/systemsBus";

type Props = {
  event: SystemsEvent | null;
  history?: SystemsEvent[];
  liveProofs?: LiveProofLite[];
  viewLabel?: string;
  refreshKey?: number;
  /** Twin phone beside the device (document flow) */
  docked?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

const PIPELINE: { id: SystemsLayer; short: string }[] = [
  { id: "device", short: "Device" },
  { id: "voice", short: "Voice" },
  { id: "policy", short: "Policy" },
  { id: "compact", short: "Compact" },
  { id: "proof-server", short: "Prove" },
  { id: "midnight", short: "Midnight" },
];

/**
 * Twin phone — Midnight / ZK / backend status beside the device, same height.
 */
export function SystemsTheater({
  event,
  history = [],
  liveProofs = [],
  viewLabel = "Circle",
  refreshKey = 0,
  docked = false,
  open = true,
  onOpenChange,
}: Props) {
  const [ledgerTransfers, setLedgerTransfers] = useState("—");
  const [proofOk, setProofOk] = useState(false);
  const [proofMode, setProofMode] = useState("—");
  const [network, setNetwork] = useState("testnet");
  const active = event ?? history[0] ?? null;
  const status = active?.status ?? "idle";

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const h = await api.health();
        if (!alive) return;
        setProofOk(Boolean(h.proofMode?.proofServerOk));
        setProofMode(String(h.proofMode?.mode ?? "—"));
        setLedgerTransfers(h.compactLedger?.transferCount ?? "—");
        const extra = h as { network?: string; midnight?: { network?: string } };
        setNetwork(String(extra.network ?? extra.midnight?.network ?? "testnet"));
      } catch {
        if (alive) {
          setProofOk(false);
          setProofMode("—");
        }
      }
    };
    void tick();
    const id = window.setInterval(tick, 2000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [refreshKey]);

  const activeLayer = active?.layer ?? "midnight";
  const circuits = useMemo(() => {
    const fromEvent = active?.circuits ?? [];
    const fromProofs = liveProofs.map((p) => p.circuit);
    return [...new Set([...fromEvent, ...fromProofs])].slice(0, 6);
  }, [active, liveProofs]);

  // Dedupe identical idle spam in the stream
  const recent = useMemo(() => {
    const out: SystemsEvent[] = [];
    for (const e of history) {
      const prev = out[out.length - 1];
      if (
        prev &&
        prev.title === e.title &&
        prev.layer === e.layer &&
        prev.status === e.status &&
        Math.abs(prev.at - e.at) < 2000
      ) {
        continue;
      }
      out.push(e);
      if (out.length >= 6) break;
    }
    return out;
  }, [history]);

  if (docked && !open) {
    return (
      <button
        type="button"
        className={`systems-tab systems-tab--${status}`}
        onClick={() => onOpenChange?.(true)}
        aria-label="Open Midnight systems theater"
      >
        <span className="systems-tab__dot" aria-hidden />
        <strong>Midnight</strong>
        <em>live</em>
      </button>
    );
  }

  return (
    <aside
      className={[
        "systems-shell",
        docked ? "systems-shell--dock" : "",
        `systems-shell--${status}`,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label="Realtime Midnight systems theater"
      data-layer={activeLayer}
    >
      <div className="phone systems-phone">
        <div className="phone__notch" aria-hidden />
        <div className="phone__screen systems-phone__screen">
          <div className={`systems systems--${status}`}>
            <header className="systems__head">
              <div className="systems__brand">
                <p className="systems__eyebrow">Midnight · live</p>
                <h2>Systems</h2>
              </div>
              <div className="systems__badges">
                <span className={`systems__pill ${proofOk ? "systems__pill--ok" : ""}`}>
                  {proofOk ? "zk-proved" : "soft"}
                </span>
                <span className="systems__pill" title={proofMode}>
                  {proofOk ? "SNARK" : proofMode === "compact-runtime" ? "runtime" : "—"}
                </span>
                <span className="systems__pill">{network}</span>
                {docked && (
                  <button
                    type="button"
                    className="systems__pill systems__pill--btn"
                    onClick={() => onOpenChange?.(false)}
                    aria-label="Minimize systems theater"
                  >
                    Hide
                  </button>
                )}
              </div>
            </header>

            <div className="systems__stage">
              <div className="systems__hud">
                <p className="systems__view">{viewLabel}</p>
                <h3 className="systems__title">{active?.title ?? "Systems idle"}</h3>
                <p className="systems__detail">
                  {active?.detail ?? "Awaiting user action on the device."}
                </p>
                <div className="systems__meta">
                  <span>{LAYER_LABEL[activeLayer]}</span>
                  <span>transfers {ledgerTransfers}</span>
                </div>
              </div>
            </div>

            <div className="systems__pipeline" role="list" aria-label="Proof pipeline">
              {PIPELINE.map((step, idx) => {
                const on = step.id === activeLayer;
                const passed =
                  PIPELINE.findIndex((p) => p.id === activeLayer) >= idx && status !== "idle";
                return (
                  <div
                    key={step.id}
                    role="listitem"
                    className={[
                      "systems__pipe",
                      on ? "systems__pipe--on" : "",
                      passed ? "systems__pipe--lit" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <em>{String(idx + 1).padStart(2, "0")}</em>
                    <strong>{step.short}</strong>
                  </div>
                );
              })}
            </div>

            <section className="systems__circuits">
              <p className="systems__section-label">Circuits</p>
              <div className="systems__chips">
                {circuits.length === 0 && (
                  <span className="systems__chip systems__chip--dim">idle</span>
                )}
                {circuits.map((c) => {
                  const live = liveProofs.find(
                    (p) => p.circuit === c || p.circuit.includes(c.replace("prove_", "")),
                  );
                  const proving =
                    status === "proving" && (active?.circuits ?? []).includes(c);
                  return (
                    <span
                      key={c}
                      className={[
                        "systems__chip",
                        live ? "systems__chip--done" : "",
                        proving ? "systems__chip--proving" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      title={live?.snarkDigest || live?.proof || c}
                    >
                      <i className="systems__chip-dot" />
                      {c.replace(/^prove_/, "")}
                      {live?.ms != null && <em>{Math.round(live.ms)}ms</em>}
                    </span>
                  );
                })}
              </div>
            </section>

            <section className="systems__log" aria-live="polite">
              <p className="systems__section-label">Stream</p>
              <ul>
                {recent.length === 0 && (
                  <li className="systems__log-empty">No events yet — use the device.</li>
                )}
                {recent.map((e) => (
                  <li
                    key={e.id}
                    className={`systems__log-item systems__log-item--${e.status}`}
                  >
                    <span className="systems__log-time">
                      {new Date(e.at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </span>
                    <span className="systems__log-title">{e.title}</span>
                    <span className="systems__log-layer">{LAYER_LABEL[e.layer]}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
        <div className="phone__home" aria-hidden />
      </div>
    </aside>
  );
}
