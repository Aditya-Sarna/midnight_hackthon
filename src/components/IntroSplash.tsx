import { useEffect, useRef, useState } from "react";

type Props = {
  onFinished: () => void;
};

/**
 * Full-bleed intro — muted, looping.
 */
export function IntroSplash({ onFinished }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;
  const [fading, setFading] = useState(false);
  const [live, setLive] = useState(false);
  const finished = useRef(false);

  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    setFading(true);
    window.setTimeout(() => onFinishedRef.current(), 700);
  };

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = true;
    el.defaultMuted = true;
    el.loop = true;
    try {
      el.setAttribute("playsinline", "");
      (el as HTMLVideoElement & { disableRemotePlayback?: boolean }).disableRemotePlayback = true;
    } catch {
      /* ignore */
    }
    const play = el.play();
    if (play && typeof play.catch === "function") {
      play.catch(() => {
        /* autoplay blocked — user can still Enter demo */
      });
    }
  }, []);

  return (
    <div
      className={`intro-splash${fading ? " intro-splash--out" : ""}${live ? " intro-splash--live" : ""}`}
      role="presentation"
    >
      <div className="intro-splash__film" aria-hidden>
        <video
          ref={videoRef}
          className="intro-splash__video"
          src="/intro.mp4?v=hold-hq-loop"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          disablePictureInPicture
          onPlaying={() => setLive(true)}
          onError={finish}
        />
        <span className="intro-splash__grade" />
      </div>

      <div className="intro-splash__dock">
        <div className="intro-splash__brand-row">
          <img src="/glyph.png" alt="" className="intro-splash__glyph" />
          <strong>Circled</strong>
        </div>
        <div className="intro-splash__actions">
          <button
            type="button"
            className="intro-splash__btn intro-splash__btn--primary"
            onClick={finish}
          >
            Enter demo
          </button>
        </div>
      </div>
    </div>
  );
}
