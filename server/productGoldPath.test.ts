/**
 * Product gold-path integration — register → fund-shaped reseal → risk/rails/KYC surfaces.
 * Complements judge:smoke (live SNARK health) without a browser.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  resetSandboxPsp,
  sandboxPspAdapter,
  signSandboxPspWebhook,
} from "./txAuth/rails/sandboxPsp.js";
import { asOpaqueDestination } from "./txAuth/types.js";
import { resolveKycProvider } from "./compliance/services/providers/onfidoShapedKyc.js";
import { OnfidoShapedKycProvider } from "./compliance/services/providers/onfidoShapedKyc.js";

describe("product gold-path surfaces", () => {
  const dirs: string[] = [];

  beforeEach(() => {
    const dir = mkdtempSync(join(tmpdir(), "circled-gold-"));
    dirs.push(dir);
    process.env.NYXPAY_STORE_PATH = join(dir, "store.db");
    resetSandboxPsp();
  });

  afterEach(async () => {
    try {
      const { closeStore } = await import("./services/store.js");
      closeStore();
    } catch {
      /* ignore */
    }
    delete process.env.NYXPAY_STORE_PATH;
    delete process.env.KYC_PROVIDER;
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  it("sandbox PSP quote→reserve→settle→webhook HMAC→status", async () => {
    const dest = sandboxPspAdapter.mintDestination({
      merchant_identifier: "m1",
      order_reference: "ord1",
      nonce: "n1",
    });
    const req = {
      intent: {
        merchant_identifier: "m1",
        order_reference: "ord1",
        amount: 0,
        currency: "CIRCLE",
        settlement_rail: "sandbox_psp",
        settlement_destination: asOpaqueDestination(dest),
        nonce: "n1",
        timestamp: Date.now(),
      },
      intent_commitment: "a".repeat(64),
      verification: {
        authorized: true as const,
        merchant_identifier: "m1",
        intent_commitment: "a".repeat(64),
        proof_challenge_id: "ch",
        verified_at: new Date().toISOString(),
        registry_version: 1,
        settlement_rail: "sandbox_psp",
        private_information_exposed: false as const,
        checks: {
          membership: true as const,
          authorization_signature: true as const,
          not_revoked: true as const,
          challenge_fresh: true as const,
          intent_bound: true as const,
        },
      },
      proof_challenge_id: "ch",
    };
    expect((await sandboxPspAdapter.quote!(req)).ok).toBe(true);
    expect((await sandboxPspAdapter.reserve!(req)).ok).toBe(true);
    const settled = await sandboxPspAdapter.settle(req);
    expect(settled.ok).toBe(true);
    const body = JSON.stringify({
      settlement_id: settled.settlement_id,
      event: "settlement.updated",
    });
    const sig = signSandboxPspWebhook(body);
    const wh = await sandboxPspAdapter.handleWebhook!({
      settlement_id: settled.settlement_id,
      event: "settlement.updated",
      rawBody: body,
      signature: sig,
    });
    expect(wh.ok).toBe(true);
    expect(wh.status).toBe("webhook_acked");
    const bad = await sandboxPspAdapter.handleWebhook!({
      settlement_id: settled.settlement_id,
      rawBody: body,
      signature: "00".repeat(32),
    });
    expect(bad.ok).toBe(false);
  });

  it("resolves onfido-shaped KYC provider via env", () => {
    process.env.KYC_PROVIDER = "onfido_shaped";
    const p = resolveKycProvider();
    expect(p).toBeInstanceOf(OnfidoShapedKycProvider);
    const ok = p.verify({
      documentReferenceHash: "b".repeat(32),
      jurisdiction: "IN",
    });
    expect(ok.pass).toBe(true);
    expect(ok.livenessPass).toBe(true);
    const fail = p.verify({
      documentReferenceHash: `${"c".repeat(28)}fail`,
      jurisdiction: "IN",
    });
    expect(fail.pass).toBe(false);
    expect(fail.exceptionCode).toBe("SANCTIONS_HIT");
  });

  it("rails hub lists sandbox_psp as live_pilot", async () => {
    const { railsHubDocument } = await import("./services/railsHub.js");
    const doc = railsHubDocument();
    const psp = doc.rails.find((r: { id: string }) => r.id === "sandbox_psp");
    expect(psp?.readiness).toBe("live_pilot");
  });
});
