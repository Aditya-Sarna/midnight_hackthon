import { describe, expect, it, vi } from "vitest";
import "./test/mocks.js";
import { registerDeviceUser, useServerHarness } from "./test/harness.js";

describe("POST /api/settle", () => {
  const harness = useServerHarness();

  it("rejects missing policy amount and then commits a valid settlement that mutates public state", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);

    const { registerRes, body: registerBody, keypair, balanceCommitment, policyCommitment } =
      await registerDeviceUser(harness, {
        displayName: "Tester",
        documentReferenceHash: "doc-hash-1",
        deviceId: "ios-test-1",
      });
    expect(registerRes.status).toBe(200);

    const oldBalanceCommitment = registerBody.user.balanceCommitment;
    const newBalanceCommitment = await harness.browserCrypto.commit(975, "bal-2");
    const newPolicyCommitment = await harness.browserCrypto.commit("policy-v2", "pol-2");
    const recipientProof = {
      circuit: "prove_recipient_valid",
      proof: "r".repeat(64),
      publicInputs: {
        kyc_registry_root: registerBody.kyc.registryRoot,
        membership: "1",
        signature_bound: "1",
        contact_commitment: await harness.browserCrypto.sha256("recipient-address"),
        contract: "contracts/nyxpay.compact",
      },
    };

    const makeSessionProof = async (intentCommitment: string, timeWindow: string) => {
      const relyingPartyId = `circled:payment:${intentCommitment}`;
      const nonce = intentCommitment.slice(0, 48);
      const challenge = await harness.browserCrypto.sha256(
        `nyxproof:challenge:${nonce}|${relyingPartyId}|${timeWindow}`
      );
      return {
        circuit: "prove_session_auth" as const,
        proof: "s".repeat(64),
        generatedAt: Date.now(),
        protocol: "circled-compact/1",
        publicInputs: {
          challenge,
          relying_party_id: await harness.browserCrypto.sha256(`rp:${relyingPartyId}`),
          kyc_registry_root: registerBody.kyc.registryRoot,
          time_window: await harness.browserCrypto.sha256(timeWindow),
        },
      };
    };

    const invalidIntentCommitment = await harness.browserCrypto.commit(
      "25|recipient-address",
      "intent-1"
    );
    const invalidSignature = await harness.browserCrypto.signMessage(
      keypair.privateKeyJwk,
      invalidIntentCommitment
    );
    const invalidTimeWindow = `${Date.now()}:${Date.now() + 60_000}`;
    const invalidSpendNullifier = harness.serverCrypto.sha256(`balnf:${oldBalanceCommitment}`);

    const invalidSettleRes = await fetch(`${harness.baseUrl}/api/settle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: registerBody.user.id,
        intentCommitment: invalidIntentCommitment,
        signature: invalidSignature,
        spendNullifier: invalidSpendNullifier,
        oldBalanceCommitment,
        newBalanceCommitment,
        newPolicyCommitment,
        recipientPubkey: registerBody.user.pubkey,
        recipientProof,
        policyProof: {
          circuit: "prove_policy_update",
          proof: "p".repeat(64),
          publicInputs: {
            old_policy_commitment: policyCommitment,
            new_policy_commitment: newPolicyCommitment,
            templates_active: "T1,T5",
            contract: "contracts/nyxpay.compact#prove_policy_update",
          },
        },
        spendProof: {
          circuit: "prove_spend_update",
          proof: "u".repeat(64),
          publicInputs: {
            old_balance_commitment: oldBalanceCommitment,
            new_balance_commitment: newBalanceCommitment,
            recipient_proof_digest: recipientProof.proof,
            nullifier: invalidSpendNullifier,
            contract: "contracts/nyxpay.compact#prove_spend_update",
          },
        },
        sessionAuthTimeWindow: invalidTimeWindow,
        sessionAuth: await makeSessionProof(invalidIntentCommitment, invalidTimeWindow),
      }),
    });

    expect(invalidSettleRes.status).toBe(422);
    await expect(invalidSettleRes.json()).resolves.toMatchObject({
      ok: false,
      reason: "balanceWitness.amount required (private)",
    });
    expect(harness.store.spentNullifiers).toHaveLength(0);
    expect(
      harness.store.users.find((user) => user.id === registerBody.user.id)?.balanceCommitment
    ).toBe(oldBalanceCommitment);

    const validIntentCommitment = await harness.browserCrypto.commit(
      "25|recipient-address",
      "intent-2"
    );
    const validSignature = await harness.browserCrypto.signMessage(
      keypair.privateKeyJwk,
      validIntentCommitment
    );
    const validTimeWindow = `${Date.now()}:${Date.now() + 60_000}`;
    const validSpendNullifier = harness.serverCrypto.sha256(`balnf:${oldBalanceCommitment}`);

    const validSettleRes = await fetch(`${harness.baseUrl}/api/settle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: registerBody.user.id,
        intentCommitment: validIntentCommitment,
        signature: validSignature,
        spendNullifier: validSpendNullifier,
        oldBalanceCommitment,
        newBalanceCommitment,
        newPolicyCommitment,
        recipientPubkey: registerBody.user.pubkey,
        recipientProof,
        policyProof: {
          circuit: "prove_policy_update",
          proof: "p".repeat(64),
          publicInputs: {
            old_policy_commitment: policyCommitment,
            new_policy_commitment: newPolicyCommitment,
            templates_active: "T1,T5",
            contract: "contracts/nyxpay.compact#prove_policy_update",
          },
        },
        spendProof: {
          circuit: "prove_spend_update",
          proof: "u".repeat(64),
          publicInputs: {
            old_balance_commitment: oldBalanceCommitment,
            new_balance_commitment: newBalanceCommitment,
            recipient_proof_digest: recipientProof.proof,
            nullifier: validSpendNullifier,
            contract: "contracts/nyxpay.compact#prove_spend_update",
          },
        },
        balanceWitness: {
          oldBalance: 1000,
          amount: 25,
          oldOpening: "11".repeat(32),
          newOpening: "22".repeat(32),
        },
        sessionAuthTimeWindow: validTimeWindow,
        sessionAuth: await makeSessionProof(validIntentCommitment, validTimeWindow),
      }),
    });

    expect(validSettleRes.status).toBe(200);
    await expect(validSettleRes.json()).resolves.toMatchObject({ ok: true });
    expect(harness.store.spentNullifiers).toContain(validSpendNullifier);
    expect(
      harness.store.users.find((user) => user.id === registerBody.user.id)?.balanceCommitment
    ).toBe(newBalanceCommitment);

    const userRes = await fetch(`${harness.baseUrl}/api/users/${registerBody.user.id}`);
    expect(userRes.status).toBe(200);
    await expect(userRes.json()).resolves.toMatchObject({
      user: {
        id: registerBody.user.id,
        balanceCommitment: newBalanceCommitment,
        policyCommitment: newPolicyCommitment,
      },
    });
    expect(balanceCommitment).toBe(oldBalanceCommitment);
  });
});
