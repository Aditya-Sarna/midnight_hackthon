import { createServer } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("enterprise hard-10 hardening", () => {
  afterEach(async () => {
    delete process.env.MERCHANT_HSM_URL;
    delete process.env.NYXPAY_MERCHANT_SIGNING;
    delete process.env.NYXPAY_REQUIRE_ONCHAIN;
    delete process.env.NYXPAY_ALLOW_ANCHOR_FALLBACK;
    delete process.env.NYXPAY_STRICT;
    delete process.env.MIDNIGHT_WALLET_SEED;
    const { setSettlementSubmitter } = await import("./services/preprodWallet.js");
    setSettlementSubmitter(null);
    const { resetMerchantSigner } = await import("./services/merchantHsm.js");
    resetMerchantSigner();
    const { resetConfigCache } = await import("./config.js");
    resetConfigCache();
    vi.resetModules();
  });

  it("broadcastSettlement uses unique live txId (not channel-anchored alias)", async () => {
    process.env.MIDNIGHT_WALLET_SEED = "ab".repeat(32);
    const { setSettlementSubmitter } = await import("./services/preprodWallet.js");
    const txIds: string[] = [];
    setSettlementSubmitter(async () => {
      const txId = `live-preprod-${txIds.length + 1}-${Date.now()}`;
      txIds.push(txId);
      return { ok: true, txId, kind: "unshielded-transfer" };
    });
    const { broadcastSettlement } = await import("./services/preprodBroadcast.js");
    const a = await broadcastSettlement({ circuit: "prove_spend_update" });
    const b = await broadcastSettlement({ circuit: "prove_spend_update" });
    expect(a.status).toBe("submitted");
    expect(b.status).toBe("submitted");
    expect(a.txId).toBeTruthy();
    expect(b.txId).toBeTruthy();
    expect(a.txId).not.toBe(b.txId);
    expect(a.txId).not.toMatch(/:settle:/);
    expect(a.kind).toBe("unshielded-transfer");
  });

  it("requireOnchain fails closed when live submit unavailable (no fake anchor)", async () => {
    process.env.NYXPAY_REQUIRE_ONCHAIN = "1";
    process.env.MIDNIGHT_WALLET_SEED = "cd".repeat(32);
    const { resetConfigCache } = await import("./config.js");
    resetConfigCache();
    const { setSettlementSubmitter } = await import("./services/preprodWallet.js");
    setSettlementSubmitter(async () => ({
      ok: false,
      reason: "unavailable",
      detail: "proof-server down",
    }));
    const { broadcastSettlement } = await import("./services/preprodBroadcast.js");
    const out = await broadcastSettlement({ circuit: "prove_spend_update" });
    expect(out.status).toBe("failed");
    expect(out.kind).toBeUndefined();
  });

  it("live HSM appliance signs without exporting secrets", async () => {
    const secrets = new Map<string, string>();
    const appliance = createServer(async (req, res) => {
      const url = new URL(req.url || "/", "http://127.0.0.1");
      const chunks: Buffer[] = [];
      for await (const c of req) chunks.push(c as Buffer);
      const body = chunks.length
        ? (JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, string>)
        : {};
      res.setHeader("content-type", "application/json");
      if (url.pathname === "/health") {
        res.end(JSON.stringify({ ok: true, appliance: "test-hsm", neverExportsSecrets: true }));
        return;
      }
      if (url.pathname === "/keys/register") {
        secrets.set(body.merchant_identifier, body.secret || "test-secret");
        res.end(JSON.stringify({ ok: true, keyId: "k1" }));
        return;
      }
      if (url.pathname === "/sign") {
        const { createHmac } = await import("node:crypto");
        const secret = secrets.get(body.merchant_identifier);
        if (!secret) {
          res.statusCode = 404;
          res.end(JSON.stringify({ error: "missing" }));
          return;
        }
        const signature = createHmac("sha256", secret).update(body.message).digest("hex");
        res.end(JSON.stringify({ signature }));
        return;
      }
      if (url.pathname === "/verify") {
        const { createHmac, timingSafeEqual } = await import("node:crypto");
        const secret = secrets.get(body.merchant_identifier) || "";
        const expected = createHmac("sha256", secret).update(body.message).digest("hex");
        const a = Buffer.from(expected, "hex");
        const b = Buffer.from(body.signature || "", "hex");
        res.end(
          JSON.stringify({ ok: a.length === b.length && timingSafeEqual(a, b) })
        );
        return;
      }
      res.statusCode = 404;
      res.end("{}");
    });
    await new Promise<void>((r) => appliance.listen(0, "127.0.0.1", () => r()));
    const { port } = appliance.address() as { port: number };
    process.env.MERCHANT_HSM_URL = `http://127.0.0.1:${port}`;
    process.env.NYXPAY_MERCHANT_SIGNING = "external";
    const { resetConfigCache } = await import("./config.js");
    resetConfigCache();
    const { getMerchantSigner, resetMerchantSigner, allowMerchantAutoProve } = await import(
      "./services/merchantHsm.js"
    );
    resetMerchantSigner();
    expect(allowMerchantAutoProve()).toBe(false);

    const signer = getMerchantSigner();
    expect(signer.mode).toBe("external");
    const health = await signer.health!();
    expect(health.ok).toBe(true);

    // register via appliance HTTP (mirrors npm run hsm:appliance)
    await fetch(`http://127.0.0.1:${port}/keys/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ merchant_identifier: "nike.com", secret: "nike-hsm-secret" }),
    });
    const sig = await signer.sign({
      merchant_identifier: "nike.com",
      message: "intent:abc",
    });
    expect(sig).toMatch(/^[a-f0-9]{64}$/);
    expect(
      await signer.verify(
        { merchant_identifier: "nike.com", message: "intent:abc" },
        sig
      )
    ).toBe(true);

    await new Promise<void>((r) => appliance.close(() => r()));
  });
});
