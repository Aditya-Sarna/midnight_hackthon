import { describe, expect, it } from "vitest";
import "./test/mocks.js";
import { registerDeviceUser, useServerHarness } from "./test/harness.js";

describe("CircleProof challenge / verify (OTP replacement)", () => {
  const harness = useServerHarness();

  it("issues a public challenge and burns it on successful verify (single-use)", async () => {
    const { registerRes, body: registerBody } = await registerDeviceUser(harness, {
      documentReferenceHash: "doc-nyxproof-1",
    });
    expect(registerRes.status).toBe(200);

    const challengeRes = await fetch(`${harness.baseUrl}/api/nyxproof/challenge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        relyingPartyId: "circled:demo-login",
        expectedUserId: registerBody.user.id,
      }),
    });
    expect(challengeRes.status).toBe(200);
    const challenge = (await challengeRes.json()) as {
      nonce: string;
      challenge: string;
      relyingPartyId: string;
      timeWindow: string;
      kycRegistryRoot: string;
    };
    expect(challenge.nonce).toBeTruthy();
    expect(challenge.challenge).toBe(
      harness.serverCrypto.sha256(
        `nyxproof:challenge:${challenge.nonce}|${challenge.relyingPartyId}|${challenge.timeWindow}`
      )
    );

    const sessionProof = {
      circuit: "prove_session_auth" as const,
      proof: "s".repeat(64),
      generatedAt: Date.now(),
      protocol: "circled-compact/1",
      publicInputs: {
        challenge: challenge.challenge,
        relying_party_id: harness.serverCrypto.sha256(`rp:${challenge.relyingPartyId}`),
        kyc_registry_root: challenge.kycRegistryRoot,
        time_window: harness.serverCrypto.sha256(challenge.timeWindow),
      },
    };

    const verifyRes = await fetch(`${harness.baseUrl}/api/nyxproof/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nonce: challenge.nonce,
        challenge: challenge.challenge,
        relyingPartyId: challenge.relyingPartyId,
        timeWindow: challenge.timeWindow,
        sessionProof,
        credentialCommitment: registerBody.user.credentialCommitment,
      }),
    });
    expect(verifyRes.status).toBe(200);
    await expect(verifyRes.json()).resolves.toMatchObject({ ok: true, burned: true });
    expect(harness.store.spentChallenges).toContain(challenge.nonce);

    const replayRes = await fetch(`${harness.baseUrl}/api/nyxproof/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nonce: challenge.nonce,
        challenge: challenge.challenge,
        relyingPartyId: challenge.relyingPartyId,
        timeWindow: challenge.timeWindow,
        sessionProof,
        credentialCommitment: registerBody.user.credentialCommitment,
      }),
    });
    expect(replayRes.status).toBe(422);
    await expect(replayRes.json()).resolves.toMatchObject({
      ok: false,
      reason: expect.stringMatching(/burned|single-use/i),
    });
  });

  it("rejects challenge issuance without relyingPartyId", async () => {
    const res = await fetch(`${harness.baseUrl}/api/nyxproof/challenge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });
});
