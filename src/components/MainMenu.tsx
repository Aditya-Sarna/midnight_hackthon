import { useEffect, useRef, useState } from "react";

export type MenuDestination =
  | "circle"
  | "truth"
  | "universal"
  | "judge"
  | "tour";

type Item = {
  id: MenuDestination;
  index: string;
  label: string;
  hint: string;
  hero?: boolean;
};

/** Lean judge menu — product + honesty + killer demo + gold path */
const ITEMS: Item[] = [
  {
    id: "circle",
    index: "●",
    label: "Circle",
    hint: "Product wallet · voice pay · Class 0 on device",
    hero: true,
  },
  {
    id: "truth",
    index: "I",
    label: "Real vs demo",
    hint: "What is live · proofMode · honest boundaries",
  },
  {
    id: "universal",
    index: "II",
    label: "Universal adapter",
    hint: "Two phones · speak to pay · Stripe test · receiver notifies",
  },
  {
    id: "judge",
    index: "III",
    label: "Command center",
    hint: "Proof health · route IDs · lifecycle receipt",
  },
  {
    id: "tour",
    index: "IV",
    label: "Guided tour",
    hint: "Voice pay gold path · zk-proved settle",
  },
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
      aria-label="Circle main menu"
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
          <p className="main-menu__kicker">Midnight · Circle</p>
          <h1 className="main-menu__title">Circle</h1>
          <p className="main-menu__lede">
            Private authorization on Midnight. Speak a payment — prove the route, settle on the
            rail the receiver accepts.
          </p>
        </header>

        <nav className="main-menu__nav" aria-label="Destinations">
          <ul className="main-menu__list">
            {ITEMS.map((item, i) => (
              <li
                key={item.id}
                style={{ ["--i" as string]: String(i) }}
                className={[
                  item.hero ? "is-hero" : "",
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
          <span>Credit · merchant · recovery live under Circle → Settings</span>
        </footer>
      </div>
    </div>
  );
}
