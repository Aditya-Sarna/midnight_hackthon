import { useEffect, useRef, useState } from "react";

export type MenuDestination =
  | "pay"
  | "tour"
  | "zk"
  | "onboarding"
  | "recovery"
  | "director"
  | "merchant"
  | "credit";

type Item = {
  id: MenuDestination;
  index: string;
  label: string;
  hint: string;
};

const ITEMS: Item[] = [
  { id: "pay", index: "I", label: "Voice pay", hint: "Speak amount and name" },
  { id: "tour", index: "II", label: "Guided tour", hint: "Judge walkthrough" },
  { id: "zk", index: "III", label: "ZK circuits", hint: "Proofs as they form" },
  { id: "merchant", index: "IV", label: "Merchant receive", hint: "QR · private inbound" },
  { id: "credit", index: "V", label: "Credit", hint: "Overcollateralized pool lend" },
  { id: "onboarding", index: "VI", label: "Set up wallet", hint: "Class 0 on device" },
  { id: "recovery", index: "VII", label: "Recovery", hint: "Threshold restore" },
  { id: "director", index: "VIII", label: "Demo hub", hint: "Explore freely" },
];

type Props = {
  onSelect: (dest: MenuDestination) => void;
};

/** Elegant editorial menu over cinematic conversation film */
export function MainMenu({ onSelect }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [videoOn, setVideoOn] = useState(false);
  const [leaving, setLeaving] = useState<MenuDestination | null>(null);
  const [hover, setHover] = useState<MenuDestination | null>(null);

  useEffect(() => {
    const id = window.requestAnimationFrame(() => setReady(true));
    const el = videoRef.current;
    if (el) {
      el.muted = true;
      el.defaultMuted = true;
      void el.play()?.catch(() => undefined);
    }
    return () => window.cancelAnimationFrame(id);
  }, []);

  function choose(id: MenuDestination) {
    if (leaving) return;
    setLeaving(id);
    try {
      videoRef.current?.pause();
    } catch {
      /* ignore */
    }
    window.setTimeout(() => onSelect(id), 580);
  }

  return (
    <div
      className={`main-menu${ready ? " main-menu--ready" : ""}${videoOn ? " main-menu--live" : ""}${leaving ? " main-menu--leaving" : ""}`}
      role="navigation"
      aria-label="Circled main menu"
    >
      <div className="main-menu__art" aria-hidden>
        <div className="main-menu__film">
          <img className="main-menu__poster" src="/menu-bg.png" alt="" />
          <video
            ref={videoRef}
            className="main-menu__video"
            src="/menu-bg.mp4?v=3"
            poster="/menu-bg.png"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            disablePictureInPicture
            onPlaying={() => setVideoOn(true)}
            onCanPlay={() => setVideoOn(true)}
          />
        </div>
        <span className="main-menu__veil" />
        <span className="main-menu__mist" />
      </div>

      <div className="main-menu__stage">
        <header className="main-menu__head">
          <img src="/glyph.png" alt="" className="main-menu__glyph" />
          <p className="main-menu__kicker">Midnight · confidential voice</p>
          <h1 className="main-menu__title">Circled</h1>
          <p className="main-menu__lede">Private money, spoken softly.</p>
        </header>

        <nav className="main-menu__nav" aria-label="Destinations">
          <ul className="main-menu__list">
            {ITEMS.map((item, i) => (
              <li
                key={item.id}
                style={{ ["--i" as string]: String(i) }}
                className={[
                  leaving === item.id ? "is-chosen" : "",
                  leaving && leaving !== item.id ? "is-dim" : "",
                  hover === item.id ? "is-hot" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <button
                  type="button"
                  onClick={() => choose(item.id)}
                  onMouseEnter={() => setHover(item.id)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(item.id)}
                  onBlur={() => setHover(null)}
                >
                  <span className="main-menu__roman">{item.index}</span>
                  <span className="main-menu__label">
                    <strong>{item.label}</strong>
                    <em>{item.hint}</em>
                  </span>
                  <span className="main-menu__line" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <footer className="main-menu__foot">
          <span>Choose a path</span>
        </footer>
      </div>
    </div>
  );
}
