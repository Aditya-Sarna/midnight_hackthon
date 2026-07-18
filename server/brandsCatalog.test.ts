import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("brands catalog (1000)", () => {
  const dirs: string[] = [];

  beforeEach(() => {
    vi.resetModules();
    const dir = mkdtempSync(join(tmpdir(), "circled-brands-"));
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

  it("loads 1000 brands with registered / unregistered split", async () => {
    const { catalogStats, loadBrandsCatalog } = await import("./services/brandsCatalog.js");
    const stats = catalogStats();
    expect(stats.total).toBe(1000);
    expect(stats.registeredCount).toBeGreaterThan(50);
    expect(stats.unregisteredCount).toBe(stats.total - stats.registeredCount);
    expect(loadBrandsCatalog().brands).toHaveLength(1000);
  });

  it("classifies Nike as verified and a random catalog brand as unverified", async () => {
    const { loadStore } = await import("./services/store.js");
    const { classifyRecipient, loadBrandsCatalog } = await import("./services/brandsCatalog.js");
    const store = loadStore();

    const nike = classifyRecipient(store, "Nike");
    expect(nike.status).toBe("verified");
    expect(nike.registered).toBe(true);
    expect(nike.logoUrl).toContain("nike.com");

    const unverified = loadBrandsCatalog().brands.find((b) => !b.registered);
    expect(unverified).toBeTruthy();
    const bad = classifyRecipient(store, unverified!.name);
    expect(bad.status).toBe("unverified_brand");
    expect(bad.registered).toBe(false);
    expect(bad.message).toMatch(/not a verified payment/i);
  });

  it("treats personal names as not_a_brand", async () => {
    const { loadStore } = await import("./services/store.js");
    const { classifyRecipient } = await import("./services/brandsCatalog.js");
    const store = loadStore();
    const person = classifyRecipient(store, "Janhvi");
    expect(person.status).toBe("not_a_brand");
  });
});
