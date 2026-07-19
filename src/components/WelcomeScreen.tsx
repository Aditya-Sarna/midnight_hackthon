import { useEffect, useRef, useState } from "react";
import "@fontsource/42dot-sans/300.css";
import "@fontsource/42dot-sans/400.css";
import "@fontsource/42dot-sans/500.css";
import "@fontsource/42dot-sans/600.css";
import "@fontsource/42dot-sans/700.css";
import "@fontsource/42dot-sans/800.css";

type Props = {
  onContinue: () => void;
};

type Line = {
  text: string;
  size?: "small" | "huge" | "tag";
};

type Screen = {
  id: string;
  invert?: boolean;
  lines: Line[];
};

const SCREENS: Screen[] = [
  {
    id: "pay",
    lines: [
      { text: "Say who to pay." },
      { text: "we handle the rest." },
    ],
  },
  {
    id: "none",
    lines: [
      { text: "No OTPs. No passwords." },
      { text: "Yes. Seriously. None of that." },
    ],
  },
  {
    id: "proof",
    lines: [
      { text: "Every payment is a proof." },
      { text: "Not a peek." },
    ],
  },
  {
    id: "hackathon",
    invert: true,
    lines: [{ text: "for the Midnight hackathon.", size: "small" }],
  },
  {
    id: "intro",
    invert: true,
    lines: [
      { text: "Introducing", size: "small" },
      { text: "CIRCLE", size: "huge" },
      { text: "Private voice agentic payments on Midnight.", size: "tag" },
    ],
  },
];

const WORD_MS = 100;
const LINE_PAUSE_MS = 320;
const SCREEN_HOLD_MS = 1100;
const FADE_MS = 480;
const EXIT_HOLD_MS = 620;

/**
 * Welcome — conversational beats; final white screen types Introducing → CIRCLE → tagline.
 */
export function WelcomeScreen({ onContinue }: Props) {
  const onContinueRef = useRef(onContinue);
  onContinueRef.current = onContinue;

  const [screenIdx, setScreenIdx] = useState(0);
  const [lineIdx, setLineIdx] = useState(0);
  const [wordIdx, setWordIdx] = useState(0);
  const [phase, setPhase] = useState<"in" | "out" | "exit">("in");

  const screen = SCREENS[screenIdx]!;
  const line = screen.lines[lineIdx]!;
  const letterMode = line.size === "huge";
  const unitCount = letterMode ? line.text.length : line.text.split(/\s+/).length;
  const typing = wordIdx < unitCount;
  const invert = Boolean(screen.invert);

  useEffect(() => {
    if (phase === "exit") {
      const t = window.setTimeout(() => onContinueRef.current(), EXIT_HOLD_MS);
      return () => window.clearTimeout(t);
    }

    if (phase === "out") {
      const t = window.setTimeout(() => {
        if (screenIdx < SCREENS.length - 1) {
          setScreenIdx((i) => i + 1);
          setLineIdx(0);
          setWordIdx(0);
          setPhase("in");
        } else {
          setPhase("exit");
        }
      }, FADE_MS);
      return () => window.clearTimeout(t);
    }

    if (typing) {
      const t = window.setTimeout(
        () => setWordIdx((w) => w + 1),
        letterMode ? 70 : WORD_MS,
      );
      return () => window.clearTimeout(t);
    }

    const t = window.setTimeout(() => {
      if (lineIdx < screen.lines.length - 1) {
        setLineIdx((i) => i + 1);
        setWordIdx(0);
      } else {
        setPhase("out");
      }
    }, lineIdx < screen.lines.length - 1 ? LINE_PAUSE_MS : SCREEN_HOLD_MS);

    return () => window.clearTimeout(t);
  }, [phase, screenIdx, lineIdx, wordIdx, typing, screen.lines.length, letterMode]);

  function shownText(l: Line, i: number): string {
    const active = i === lineIdx;
    if (!active) return l.text;
    if (l.size === "huge") return l.text.slice(0, wordIdx);
    return l.text.split(/\s+/).slice(0, wordIdx).join(" ");
  }

  function isTypingLine(l: Line, i: number): boolean {
    if (i !== lineIdx) return false;
    if (l.size === "huge") return wordIdx < l.text.length;
    return wordIdx < l.text.split(/\s+/).length;
  }

  return (
    <div
      className={[
        "welcome",
        screen.id === "pay" ? "welcome--pay" : "",
        screen.id === "none" ? "welcome--none" : "",
        invert ? "welcome--invert" : "",
        phase === "exit" ? "welcome--exit" : "",
        phase === "out" ? "welcome--screen-out" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      role="main"
      aria-live="polite"
      aria-label="Introducing Circle"
    >
      {screen.id === "pay" ? (
        <div className="welcome__bg" aria-hidden>
          <video
            className="welcome__bg-video"
            src="/welcome-pay.mp4"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            disablePictureInPicture
          />
        </div>
      ) : null}
      {screen.id === "none" ? (
        <div className="welcome__bg" aria-hidden>
          <video
            className="welcome__bg-video"
            src="/welcome-none.mp4"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            disablePictureInPicture
          />
        </div>
      ) : null}
      <div
        className={[
          "welcome__stack",
          `welcome__stack--${screen.id}`,
          phase === "in" && lineIdx === 0 && wordIdx === 0 ? "welcome__stack--enter" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {screen.lines.map((l, i) => {
          if (i > lineIdx) return null;
          const shown = shownText(l, i);
          const showCaret = isTypingLine(l, i);
          const sizeClass = l.size ? `welcome__line--${l.size}` : "welcome__line--big";
          return (
            <p
              key={`${screen.id}-${i}`}
              className={`welcome__line ${sizeClass}`}
            >
              {shown}
              {showCaret ? <span className="welcome__caret" aria-hidden /> : null}
            </p>
          );
        })}
      </div>
    </div>
  );
}
