import { useEffect, useMemo, useRef, useState } from "react";
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
  /** Fixed right dock — always on screen */
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
 * Parallel systems screen — realtime animated explanation of Midnight / ZK / backend
 * for whatever the user is doing on the primary UI.
 */
export function SystemsTheater({
  event,
  history = [],
  liveProofs = [],
  viewLabel = "Circled",
  refreshKey = 0,
  docked = false,
  open = true,
  onOpenChange,
}: Props) {
  const [pulse, setPulse] = useState(0);
  const [ledgerTransfers, setLedgerTransfers] = useState("—");
  const [proofOk, setProofOk] = useState(false);
  const [network, setNetwork] = useState("testnet");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const active = event ?? history[0] ?? null;
  const intensity = active?.intensity ?? 0.25;
  const status = active?.status ?? "idle";

  // Soft pulse clock for ambient motion
  useEffect(() => {
    const id = window.setInterval(() => setPulse((p) => p + 1), 80);
    return () => window.clearInterval(id);
  }, []);

  // Health / ledger heartbeat
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const h = await api.health();
        if (!alive) return;
        setProofOk(Boolean(h.proofMode?.proofServerOk));
        setLedgerTransfers(h.compactLedger?.transferCount ?? "—");
        const extra = h as { network?: string; midnight?: { network?: string } };
        setNetwork(String(extra.network ?? extra.midnight?.network ?? "testnet"));
      } catch {
        if (alive) setProofOk(false);
      }
    };
    void tick();
    const id = window.setInterval(tick, 2000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [refreshKey]);

  // Particle field on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    type P = { x: number; y: number; vx: number; vy: number; r: number; a: number };
    const particles: P[] = Array.from({ length: 48 }, () => ({
      x: Math.random(),
      y: Math.random(),
      vx: (Math.random() - 0.5) * 0.0015,
      vy: (Math.random() - 0.5) * 0.0015,
      r: 1 + Math.random() * 2.2,
      a: 0.15 + Math.random() * 0.45,
    }));

    const draw = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);

      // Mesh links
      const boost = 0.35 + intensity * 0.65;
      for (let i = 0; i < particles.length; i++) {
        const a = particles[i]!;
        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j]!;
          const dx = (a.x - b.x) * w;
          const dy = (a.y - b.y) * h;
          const dist = Math.hypot(dx, dy);
          if (dist < 90 * boost) {
            ctx.strokeStyle = `rgba(232, 196, 120, ${0.08 * boost * (1 - dist / 120)})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.x * w, a.y * h);
            ctx.lineTo(b.x * w, b.y * h);
            ctx.stroke();
          }
        }
      }

      for (const p of particles) {
        p.x += p.vx * (0.6 + intensity * 1.8);
        p.y += p.vy * (0.6 + intensity * 1.8);
        if (p.x < 0 || p.x > 1) p.vx *= -1;
        if (p.y < 0 || p.y > 1) p.vy *= -1;
        p.x = Math.max(0, Math.min(1, p.x));
        p.y = Math.max(0, Math.min(1, p.y));

        const glow = status === "proving" ? 1.4 : status === "settled" ? 1.1 : 1;
        ctx.beginPath();
        ctx.fillStyle = `rgba(247, 241, 232, ${p.a * boost * glow})`;
        ctx.arc(p.x * w, p.y * h, p.r * glow, 0, Math.PI * 2);
        ctx.fill();
      }

      // Orbiting “proof” ring when proving
      if (status === "proving" || status === "active") {
        const t = performance.now() / 1000;
        const cx = w * 0.5;
        const cy = h * 0.42;
        const rad = 36 + Math.sin(t * 2) * 4;
        ctx.strokeStyle = `rgba(232, 196, 120, ${0.35 + intensity * 0.4})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, rad, t, t + Math.PI * 1.4);
        ctx.stroke();
        ctx.beginPath();
        ctx.strokeStyle = `rgba(158, 203, 138, ${0.25 + intensity * 0.35})`;
        ctx.arc(cx, cy, rad + 12, -t * 1.3, -t * 1.3 + Math.PI);
        ctx.stroke();
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [intensity, status, pulse]);

  const activeLayer = active?.layer ?? "midnight";
  const circuits = useMemo(() => {
    const fromEvent = active?.circuits ?? [];
    const fromProofs = liveProofs.map((p) => p.circuit);
    return [...new Set([...fromEvent, ...fromProofs])].slice(0, 6);
  }, [active, liveProofs]);

  const recent = history.slice(0, 6);

  if (docked && !open) {
    return (
      <button
        type="button"
        className={`systems-tab systems-tab--${status}`}
        onClick={() => onOpenChange?.(true)}
        aria-label="Open Midnight systems theater"
      >
        <span className="systems-tab__pulse" aria-hidden />
        <strong>Systems</strong>
        <em>live</em>
      </button>
    );
  }

  return (
    <aside
      className={[
        "systems",
        `systems--${status}`,
        docked ? "systems--dock" : "",
        docked && open ? "systems--dock-open" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label="Realtime Midnight systems theater"
      data-layer={activeLayer}
    >
      <header className="systems__head">
        <div>
          <p className="systems__eyebrow">Parallel systems · live</p>
          <h2>What Midnight is doing</h2>
        </div>
        <div className="systems__badges">
          <span className={`systems__pill ${proofOk ? "systems__pill--ok" : ""}`}>
            {proofOk ? "proof-server" : "proof soft"}
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
        <canvas ref={canvasRef} className="systems__canvas" aria-hidden />
        <div className="systems__hud">
          <p className="systems__view">{viewLabel}</p>
          <h3 className="systems__title">{active?.title ?? "Systems idle"}</h3>
          <p className="systems__detail">{active?.detail ?? "Awaiting user action on the device."}</p>
          <div className="systems__meta">
            <span>{LAYER_LABEL[activeLayer]}</span>
            <span>transfers {ledgerTransfers}</span>
          </div>
        </div>
        <div className={`systems__orb systems__orb--${status}`} aria-hidden>
          <i />
          <i />
          <i />
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
              {on && <span className="systems__pipe-pulse" />}
            </div>
          );
        })}
      </div>

      <section className="systems__circuits">
        <p className="systems__section-label">Circuits in flight</p>
        <div className="systems__chips">
          {circuits.length === 0 && <span className="systems__chip systems__chip--dim">none</span>}
          {circuits.map((c) => {
            const live = liveProofs.find((p) => p.circuit === c || p.circuit.includes(c.replace("prove_", "")));
            const proving = status === "proving" && (active?.circuits ?? []).includes(c);
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
        <p className="systems__section-label">Action stream</p>
        <ul>
          {recent.length === 0 && <li className="systems__log-empty">No events yet — tap the device.</li>}
          {recent.map((e) => (
            <li key={e.id} className={`systems__log-item systems__log-item--${e.status}`}>
              <span className="systems__log-time">
                {new Date(e.at).toLocaleTimeString([], { minute: "2-digit", second: "2-digit" })}
              </span>
              <span className="systems__log-title">{e.title}</span>
              <span className="systems__log-layer">{LAYER_LABEL[e.layer]}</span>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}
