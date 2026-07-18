import { describe, expect, it } from "vitest";
import "./test/mocks.js";
import { registerDeviceUser, useServerHarness } from "./test/harness.js";

describe("POST /api/register + policy commit", () => {
  const harness = useServerHarness();

  it("registers commitments-only account and updates policy without Class 0 leak", async () => {
    const { registerRes, body, keypair, policyCommitment } = await registerDeviceUser(harness, {
      displayName: "Aditya",
      documentReferenceHash: "doc-register-1",
    });
    expect(registerRes.status).toBe(200);
    expect(body.user.class0DeviceOnly).toBe(true);
    expect(body.user).not.toHaveProperty("privateKey");
    expect(body.user).not.toHaveProperty("balance");
    expect(body.kyc.registryRoot).toBeTruthy();
    expect(harness.store.users).toHaveLength(1);

    const newPolicyCommitment = await harness.browserCrypto.commit("policy-v2", "pol-2");
    const intentCommitment = await harness.browserCrypto.commit(
      `policy:${newPolicyCommitment}`,
      "pol-intent"
    );
    const signature = await harness.browserCrypto.signMessage(
      keypair.privateKeyJwk,
      intentCommitment
    );

    const policyRes = await fetch(`${harness.baseUrl}/api/users/${body.user.id}/policy`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        policyCommitment: newPolicyCommitment,
        active: ["T1", "T5", "T8"],
        signature,
        intentCommitment,
      }),
    });
    expect(policyRes.status).toBe(200);
    await expect(policyRes.json()).resolves.toMatchObject({
      user: {
        id: body.user.id,
        policyCommitment: newPolicyCommitment,
        policyActive: ["T1", "T5", "T8"],
        policyParams: null,
      },
    });

    const proveRes = await fetch(`${harness.baseUrl}/api/users/${body.user.id}/prove-context`);
    expect(proveRes.status).toBe(200);
    await expect(proveRes.json()).resolves.toMatchObject({
      kycRoot: body.kyc.registryRoot,
      policyCommitment: newPolicyCommitment,
    });
    expect(body.user.policyCommitment).toBe(policyCommitment);
  });

  it("rejects incomplete registration payloads", async () => {
    const res = await fetch(`${harness.baseUrl}/api/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: "Nope" }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
