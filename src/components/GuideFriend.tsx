import { useEffect, useMemo, useRef, useState } from "react";
import {
  GUIDE_FRIEND_NAME,
  GUIDE_STEPS,
  type GuideAction,
  type GuideStep,
} from "../lib/guideScript";

type Props = {
  /** Current wallet phase — gates Next when waitFor is set */
  walletPhase?: string;
  onAction: (action: GuideAction, step: GuideStep) => void;
  onTheaterFocus?: (focus: GuideStep["theaterFocus"]) => void;
  onComplete?: () => void;
};

export function GuideFriend({ walletPhase, onAction, onTheaterFocus, onComplete }: Props) {
  const [idx, setIdx] = useState(0);
  const [autoplay, setAutoplay] = useState(false);
  const [typed, setTyped] = useState("");
  const [ready, setReady] = useState(false);
  const [waitMet, setWaitMet] = useState(false);
  const lastActionKey = useRef("");
  const step = GUIDE_STEPS[idx];
  const done = idx >= GUIDE_STEPS.length - 1 && ready;

  useEffect(() => {
    setWaitMet(!step.waitFor);
  }, [step.id, step.waitFor]);

  useEffect(() => {
    if (!step.waitFor) return;
    if (walletPhase === step.waitFor) setWaitMet(true);
  }, [walletPhase, step.waitFor, step.id]);

  const waiting = Boolean(step.waitFor) && !waitMet;

  // Typewriter for friend line
  useEffect(() => {
    setTyped("");
    setReady(false);
    const full = step.say;
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setTyped(full.slice(0, i));
      if (i >= full.length) {
        window.clearInterval(id);
        setReady(true);
      }
    }, 14);
    return () => window.clearInterval(id);
  }, [step.id, step.say]);

  // Fire step action once when entering step (after brief settle)
  useEffect(() => {
    const key = `${step.id}:${step.action?.type ?? "idle"}`;
    if (lastActionKey.current === key) return;
    lastActionKey.current = key;
    onTheaterFocus?.(step.theaterFocus);
    const t = window.setTimeout(() => {
      if (step.action) onAction(step.action, step);
    }, 480);
    return () => window.clearTimeout(t);
  }, [step, onAction, onTheaterFocus]);

  const canAdvance = ready && !waiting;

  function next() {
    if (!canAdvance) return;
    if (idx >= GUIDE_STEPS.length - 1) {
      onComplete?.();
      return;
    }
    setIdx((n) => Math.min(n + 1, GUIDE_STEPS.length - 1));
  }

  // Autoplay
  useEffect(() => {
    if (!autoplay || !canAdvance) return;
    const ms = step.autoMs ?? 4000;
    const id = window.setTimeout(() => next(), ms);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoplay, canAdvance, idx, step.id]);

  const progress = useMemo(
    () => Math.round(((idx + (ready ? 1 : 0)) / GUIDE_STEPS.length) * 100),
    [idx, ready]
  );

  return (
    <aside className="guide" aria-label="Guided demo companion">
      <header className="guide__head">
        <div className="guide__avatar" aria-hidden>
          N
        </div>
        <div>
          <p className="guide__eyebrow">Your guide</p>
          <h2>{GUIDE_FRIEND_NAME}</h2>
        </div>
        <span className="guide__progress">{progress}%</span>
      </header>

      <div className="guide__track" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
        <i style={{ width: `${progress}%` }} />
      </div>

      <ol className="guide__beats">
        {GUIDE_STEPS.map((s, i) => (
          <li
            key={s.id}
            className={
              i < idx ? "done" : i === idx ? "current" : ""
            }
          >
            {i + 1}
          </li>
        ))}
      </ol>

      <div className="guide__chat">
        <div className="guide__bubble">
          <strong>{GUIDE_FRIEND_NAME}</strong>
          <p>
            {typed}
            {!ready && <span className="guide__caret" />}
          </p>
        </div>

        {ready &&
          step.boxes?.map((box) => (
            <article key={box.title} className={`guide__box guide__box--${box.tag ?? "device"}`}>
              <span>{box.tag ?? "note"}</span>
              <h3>{box.title}</h3>
              <p>{box.body}</p>
            </article>
          ))}
      </div>

      {waiting && (
        <p className="guide__wait">
          Working on the phone…{" "}
          <em>waiting for {step.waitFor}</em>
        </p>
      )}

      <footer className="guide__actions">
        <button
          type="button"
          className={`btn ghost ${autoplay ? "guide__auto-on" : ""}`}
          onClick={() => setAutoplay((a) => !a)}
        >
          {autoplay ? "Pause autoplay" : "Autoplay"}
        </button>
        <button
          type="button"
          className="btn primary"
          disabled={!canAdvance && !done}
          onClick={next}
        >
          {idx >= GUIDE_STEPS.length - 1 ? "Finish tour" : waiting ? "…" : "Next"}
        </button>
      </footer>

      <p className="guide__hint muted">
        Tip for judges: leave Autoplay on — phone + proofs stay in sync.
      </p>
    </aside>
  );
}
