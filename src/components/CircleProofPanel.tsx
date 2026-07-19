import { useState } from "react";
import { loadVault } from "../lib/deviceVault";
import { proveSessionAuth, type CircleProofChallenge } from "../lib/nyxproof";
import { loadSession } from "../lib/api";

/**
 * External relying-party demo — Circle session auth as OTP/2FA replacement.
 * Challenge is public; device proves KYC possession locally; nonce burned once.
 */
export function CircleProofPanel() {
  const [rpId, setRpId] = useState("https://example-bank.demo/login");
  const [unlinkable, setUnlinkable] = useState(true);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [ok, setOk] = useState<boolean | null>(null);

  function push(line: string) {
    setLog((prev) => [line, ...prev].slice(0, 8));
  }

  async function runAuth() {
    setBusy(true);
    setOk(null);
    setLog([]);
    try {
      const userId = loadSession();
      if (!userId) throw new Error("Launch demo first — need a device vault");
      const vault = await loadVault(userId);
      if (!vault) throw new Error("Device Class 0 vault missing");

      push("1. RP issues public challenge (not a secret)");
      const chRes = await fetch("/api/circledproof/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ relyingPartyId: rpId, unlinkable }),
      });
      const challenge = (await chRes.json()) as CircleProofChallenge & { error?: string };
      if (!chRes.ok) throw new Error(challenge.error || "challenge failed");

      push("2. Device proves KYC possession locally — no code typed");
      const sessionProof = await proveSessionAuth(vault, challenge);

      push("3. Verifier checks proof + burns nonce (single-use)");
      const vRes = await fetch("/api/circledproof/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nonce: challenge.nonce,
          challenge: challenge.challenge,
          relyingPartyId: challenge.relyingPartyId,
          timeWindow: challenge.timeWindow,
          sessionProof,
          credentialCommitment: sessionProof.credentialCommitment,
        }),
      });
      const verified = await vRes.json();
      if (!vRes.ok || !verified.ok) {
        throw new Error(verified.reason || verified.error || "verify failed");
      }

      push(
        unlinkable
          ? "✓ Authenticated — unlinkable (no stable user handle)"
          : "✓ Authenticated — challenge burned"
      );
      push("No SMS · no TOTP · no interceptable secret");
      setOk(true);

      // Replay must fail
      const replay = await fetch("/api/circledproof/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nonce: challenge.nonce,
          challenge: challenge.challenge,
          relyingPartyId: challenge.relyingPartyId,
          timeWindow: challenge.timeWindow,
          sessionProof,
        }),
      });
      const replayBody = await replay.json();
      push(
        replayBody.ok
          ? "✗ Replay unexpectedly accepted"
          : `✓ Replay rejected: ${replayBody.reason || "burned"}`
      );
    } catch (e) {
      setOk(false);
      push(e instanceof Error ? e.message : "Circle failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="circledproof">
      <header className="circledproof__head">
        <p className="theater__eyebrow">Circle</p>
        <h2>OTP replacement</h2>
        <p>
          Prove credential possession — no code to intercept, phish, or SIM-swap.
        </p>
      </header>

      <label className="circledproof__field">
        Relying party
        <input value={rpId} onChange={(e) => setRpId(e.target.value)} />
      </label>
      <label className="circledproof__check">
        <input
          type="checkbox"
          checked={unlinkable}
          onChange={(e) => setUnlinkable(e.target.checked)}
        />
        Unlinkable mode (no stable per-user handle)
      </label>

      <button
        type="button"
        className="btn primary"
        disabled={busy}
        onClick={() => void runAuth()}
      >
        {busy ? "Proving…" : "Authenticate without OTP"}
      </button>

      {ok !== null && (
        <p className={ok ? "circledproof__ok" : "circledproof__err"}>
          {ok ? "Session authenticated" : "Failed"}
        </p>
      )}

      <ul className="circledproof__log">
        {log.map((line, i) => (
          <li key={`${i}-${line.slice(0, 12)}`}>{line}</li>
        ))}
      </ul>
    </div>
  );
}
