import { useState } from "react";
import type { RecipientMatch, RecipientVerification } from "../lib/api";

export type ResolutionCandidate = RecipientMatch & {
  hintText?: string;
  hintStrength?: number;
  responded?: boolean;
};

export type ResolutionState = "silent" | "candidates" | "proximity" | "no-match";

export const IDENTITY_TRUST_COPY =
  "no address or identity shown — only what each person has chosen to reveal for this request.";

export function orderResolutionCandidates(
  candidates: ResolutionCandidate[]
): ResolutionCandidate[] {
  return candidates
    .filter((candidate) => candidate.responded !== false)
    .sort((left, right) => (right.hintStrength ?? 0) - (left.hintStrength ?? 0));
}

export function resolutionState(
  result: RecipientVerification,
  proximityAvailable = false
): ResolutionState {
  const candidates = orderResolutionCandidates(result.matches ?? []);
  if (result.status === "verified" && candidates.length <= 1) return "silent";
  if (result.status === "ambiguous" && candidates.length > 1) return "candidates";
  if (proximityAvailable) return "proximity";
  return "no-match";
}

type CandidateRowProps = {
  candidate: ResolutionCandidate;
  disabled?: boolean;
  onTap: (candidateId: string) => void;
};

export function CandidateRow({ candidate, disabled, onTap }: CandidateRowProps) {
  const initial = candidate.displayName.trim().slice(0, 1).toUpperCase() || "?";
  return (
    <li>
      <button
        type="button"
        className="identity-resolve__candidate"
        disabled={disabled}
        onClick={() => onTap(candidate.id)}
      >
        <span className="identity-resolve__avatar" aria-hidden>{initial}</span>
        <span className="identity-resolve__candidate-copy">
          <strong>{candidate.displayName}</strong>
          <span>{candidate.hintText || `${candidate.jurisdiction} · ${candidate.asset} · @${candidate.handle}`}</span>
        </span>
        <span className="identity-resolve__chevron" aria-hidden>›</span>
      </button>
    </li>
  );
}

type CandidateListProps = {
  candidates: ResolutionCandidate[];
  disabled?: boolean;
  onSelect: (candidateId: string) => void;
  onCancel: () => void;
};

export function CandidateList({ candidates, disabled, onSelect, onCancel }: CandidateListProps) {
  const ordered = orderResolutionCandidates(candidates);
  return (
    <section
      className="identity-resolve"
      aria-labelledby="identity-resolve-title"
      onClick={(event) => event.stopPropagation()}
    >
      <header className="identity-resolve__header">
        <button type="button" className="identity-resolve__back" onClick={onCancel} aria-label="Cancel identity resolution">‹</button>
        <div>
          <h2 id="identity-resolve-title">{ordered.length} matches found — who did you mean?</h2>
          <p>{IDENTITY_TRUST_COPY}</p>
        </div>
      </header>
      <ul className="identity-resolve__list">
        {ordered.map((candidate) => (
          <CandidateRow key={candidate.id} candidate={candidate} disabled={disabled} onTap={onSelect} />
        ))}
      </ul>
    </section>
  );
}

type NoSafeMatchProps = {
  possibleMatchSilent?: boolean;
  proximityAvailable?: boolean;
  onProximity: () => void;
  onRetry: () => void;
  onCancel: () => void;
};

export function NoSafeMatch({
  possibleMatchSilent,
  proximityAvailable,
  onProximity,
  onRetry,
  onCancel,
}: NoSafeMatchProps) {
  return (
    <section
      className="identity-resolve identity-resolve--empty"
      aria-labelledby="identity-resolve-title"
      onClick={(event) => event.stopPropagation()}
    >
      <button type="button" className="identity-resolve__back" onClick={onCancel} aria-label="Cancel identity resolution">‹</button>
      <span className="identity-resolve__empty-mark" aria-hidden>?</span>
      <h2 id="identity-resolve-title">Can’t confirm this person yet</h2>
      <p>
        {possibleMatchSilent
          ? "found a possible match, but they haven’t confirmed who they are yet."
          : "no one matching that name has shared enough to confirm — try again in person, or check the name."}
      </p>
      <div className="identity-resolve__actions">
        {proximityAvailable && (
          <button type="button" className="identity-resolve__primary" onClick={onProximity}>Confirm in person</button>
        )}
        <button type="button" className="identity-resolve__secondary" onClick={onRetry}>Try with more context</button>
      </div>
    </section>
  );
}

type ProximityHandoffProps = {
  onContinue: () => void;
  onCancel: () => void;
};

export function ProximityHandoff({ onContinue, onCancel }: ProximityHandoffProps) {
  return (
    <section
      className="identity-resolve identity-resolve--empty"
      aria-labelledby="identity-resolve-title"
      onClick={(event) => event.stopPropagation()}
    >
      <button type="button" className="identity-resolve__back" onClick={onCancel} aria-label="Cancel identity resolution">‹</button>
      <span className="identity-resolve__empty-mark" aria-hidden>⌁</span>
      <h2 id="identity-resolve-title">Confirm together</h2>
      <p>Use their Circle QR or nearby contact signal to confirm the right person.</p>
      <button type="button" className="identity-resolve__primary" onClick={onContinue}>Open contact scan</button>
    </section>
  );
}

type DisambiguationFlowProps = {
  result: RecipientVerification;
  busy?: boolean;
  proximityAvailable?: boolean;
  onResolved: (candidateId: string) => void;
  onNoMatch: () => void;
  onProximity: () => void;
  onRetry: () => void;
  onCancel: () => void;
};

/**
 * Identity resolution is Circled's only text-and-list UI exception. It exists
 * solely to prevent unsafe person selection; it is not precedent for adding
 * text or lists to any other product surface.
 */
export function DisambiguationFlow({
  result,
  busy,
  proximityAvailable,
  onResolved,
  onNoMatch,
  onProximity,
  onRetry,
  onCancel,
}: DisambiguationFlowProps) {
  const [proximityOffered, setProximityOffered] = useState(false);
  const state = resolutionState(result, proximityAvailable);
  if (state === "silent") return null;
  if (state === "candidates") {
    return <CandidateList candidates={result.matches ?? []} disabled={busy} onSelect={onResolved} onCancel={onCancel} />;
  }
  if (state === "proximity" && proximityOffered) {
    return <ProximityHandoff onContinue={onProximity} onCancel={onCancel} />;
  }
  return (
    <NoSafeMatch
      possibleMatchSilent={(result.matches?.length ?? 0) > 0}
      proximityAvailable={proximityAvailable}
      onProximity={() => setProximityOffered(true)}
      onRetry={onRetry}
      onCancel={() => { onNoMatch(); onCancel(); }}
    />
  );
}