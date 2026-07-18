import { describe, expect, it } from "vitest";
import "./test/mocks.js";
import { useServerHarness } from "./test/harness.js";

describe("GET /api/health + public surfaces", () => {
  const harness = useServerHarness();

  it("reports ok with mocked midnight/proof/onchain posture", async () => {
    const res = await fetch(`${harness.baseUrl}/api/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      ok: true,
      service: "circled",
      class0: "device-only",
      nyxproof: true,
      midnight: { ok: true, networkId: "testnet" },
      proofMode: { mode: "compact-runtime", artifactsOk: true },
      onchain: { readyForSubmit: false },
    });
    expect(body.compliance.services).toBeGreaterThan(0);
  });

  it("exposes ledger and compliance inventory without Class 0 fields", async () => {
    const [ledgerRes, complianceRes, nyxproofRes] = await Promise.all([
      fetch(`${harness.baseUrl}/api/ledger`),
      fetch(`${harness.baseUrl}/api/compliance`),
      fetch(`${harness.baseUrl}/api/nyxproof`),
    ]);
    expect(ledgerRes.status).toBe(200);
    expect(complianceRes.status).toBe(200);
    expect(nyxproofRes.status).toBe(200);

    const [ledger, compliance, nyxproof] = await Promise.all([
      ledgerRes.json(),
      complianceRes.json(),
      nyxproofRes.json(),
    ]);
    expect(compliance.productionGrade.class0).toMatch(/device/i);
    expect(compliance.productionGrade.storeSchema).toBe(4);
    expect(compliance.productionGrade.storeEngine).toBe("better-sqlite3");
    expect(compliance.productionGrade.proofPath).toMatch(/\/prove/);
    // Ledger surface is public events only — no Class 0 secret fields as keys
    expect(JSON.stringify(ledger)).not.toMatch(/"privateKey"|"balanceNonce"/);
    expect(nyxproof).toMatchObject({
      title: expect.stringMatching(/CircledProof/i),
      circuit: "prove_session_auth",
    });
  });
});
