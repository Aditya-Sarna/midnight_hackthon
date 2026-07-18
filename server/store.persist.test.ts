import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { STORE_ENGINE, STORE_SCHEMA_VERSION } from "./services/store.js";

describe("better-sqlite3 store persistence", () => {
  const dirs: string[] = [];

  afterEach(async () => {
    vi.resetModules();
    delete process.env.NYXPAY_STORE_PATH;
    for (const dir of dirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("uses the stable better-sqlite3 engine (not experimental node:sqlite)", () => {
    expect(STORE_ENGINE).toBe("better-sqlite3");
    expect(STORE_SCHEMA_VERSION).toBe(4);
  });

  it("round-trips public state across process module reloads", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "circled-store-persist-"));
    dirs.push(tempDir);
    const dbPath = join(tempDir, "circled-store.db");
    process.env.NYXPAY_STORE_PATH = dbPath;

    vi.resetModules();
    const storeMod = await import("./services/store.js");
    const store = storeMod.loadStore();
    store.users.push({
      id: "u1",
      displayName: "Persist",
      deviceId: "dev-1",
      pubkey: "pk",
      publicKeyJwk: { kty: "EC", crv: "P-256", x: "x", y: "y" },
      credentialCommitment: "cred",
      balanceCommitment: "bal",
      policyCommitment: "pol",
      policyActive: ["T1"],
      kycNullifier: "nf",
      createdAt: Date.now(),
      class0DeviceOnly: true,
    });
    store.spentNullifiers.push("spent-1");
    storeMod.saveStore(store);
    storeMod.closeStore();

    vi.resetModules();
    process.env.NYXPAY_STORE_PATH = dbPath;
    const reloaded = await import("./services/store.js");
    const again = reloaded.loadStore();
    expect(again.users).toHaveLength(1);
    expect(again.users[0]?.displayName).toBe("Persist");
    expect(again.spentNullifiers).toContain("spent-1");
    expect(again.schemaVersion).toBe(STORE_SCHEMA_VERSION);
    reloaded.closeStore();
  });
});
