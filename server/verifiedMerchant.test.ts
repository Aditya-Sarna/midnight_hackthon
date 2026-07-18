import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("verified-merchant-payment skill", () => {
  const dirs: string[] = [];

  beforeEach(() => {
    vi.resetModules();
    const dir = mkdtempSync(join(tmpdir(), "circled-merchant-"));
    dirs.push(dir);
    process.env.NYXPAY_STORE_PATH = join(dir, "store.db");
  });

  afterEach(async () => {
    try {
      const { closeStore } = await import("./services/store.js");
      closeStore();
    } catch {
      /* ignore */
    }
    delete process.env.NYXPAY_STORE_PATH;
    vi.resetModules();
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  it("verifies Nike with membership + address binding + fresh challenge", async () => {
    const { loadStore } = await import("./services/store.js");
    const vm = await import("./services/verifiedMerchant.js");
    const store = loadStore();
    vm.ensureDemoBrandRegistries(store);

    const ok = vm.verifyMerchantPayment(store, {
      merchant_identifier: "nike.com",
      payment_address: "0x8a72f9c1d4e5b6a7080910111213141516171819",
      network: "ethereum",
      amount: 129.99,
      required_claims: ["official_merchant", "owns_payment_address"],
    });

    expect(ok.verified).toBe(true);
    if (!ok.verified) return;
    expect(ok.merchant).toBe("Nike Inc.");
    expect(ok.private_information_exposed).toBe(false);
    expect(ok.claims_verified).toContain("not_revoked");
    expect(ok.proof_challenge_id).toMatch(/^chal_/);
    expect(ok.checks.address_binding).toBe(true);
  });

  it("rejects attacker-controlled payment address (address_binding_invalid)", async () => {
    const { loadStore } = await import("./services/store.js");
    const vm = await import("./services/verifiedMerchant.js");
    const store = loadStore();
    vm.ensureDemoBrandRegistries(store);

    const bad = vm.verifyMerchantPayment(store, {
      merchant_identifier: "nike.com",
      payment_address: "0xattackerownedwallet00000000000000000001",
      network: "ethereum",
    });
    expect(bad.verified).toBe(false);
    if (bad.verified) return;
    expect(bad.reason).toBe("address_binding_invalid");
  });

  it("rejects unknown merchant with distinct reason", async () => {
    const { loadStore } = await import("./services/store.js");
    const vm = await import("./services/verifiedMerchant.js");
    const store = loadStore();
    vm.ensureDemoBrandRegistries(store);

    const bad = vm.verifyMerchantPayment(store, {
      merchant_identifier: "not-a-real-brand.xyz",
      payment_address: "0x8a72f9c1d4e5b6a7080910111213141516171819",
      network: "ethereum",
    });
    expect(bad.verified).toBe(false);
    if (bad.verified) return;
    expect(bad.reason).toBe("merchant_not_found_in_registry");
  });

  it("rejects unsupported claims instead of silently ignoring them", async () => {
    const { loadStore } = await import("./services/store.js");
    const vm = await import("./services/verifiedMerchant.js");
    const store = loadStore();
    vm.ensureDemoBrandRegistries(store);

    const bad = vm.verifyMerchantPayment(store, {
      merchant_identifier: "nike.com",
      payment_address: "0x8a72f9c1d4e5b6a7080910111213141516171819",
      network: "ethereum",
      required_claims: ["registered_business"],
    });
    expect(bad.verified).toBe(false);
    if (bad.verified) return;
    expect(bad.reason).toBe("unsupported_claim_requested");
  });

  it("fails after revocation via nullifier set", async () => {
    const { loadStore } = await import("./services/store.js");
    const vm = await import("./services/verifiedMerchant.js");
    const store = loadStore();
    vm.ensureDemoBrandRegistries(store);

    const rev = vm.revokeMerchant(store, "nike.com");
    expect(rev.ok).toBe(true);

    const bad = vm.verifyMerchantPayment(store, {
      merchant_identifier: "nike.com",
      payment_address: "0x8a72f9c1d4e5b6a7080910111213141516171819",
      network: "ethereum",
    });
    expect(bad.verified).toBe(false);
    if (bad.verified) return;
    expect(bad.reason).toBe("nullifier_revoked");
  });
});
