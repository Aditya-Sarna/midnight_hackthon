import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, vi } from "vitest";

export type ServerHarness = {
  baseUrl: string;
  store: Awaited<typeof import("../index.js")>["store"];
  browserCrypto: typeof import("../../src/lib/crypto");
  serverCrypto: typeof import("../services/crypto");
};

/**
 * Boots Express against an isolated better-sqlite3 store for one describe block.
 * Import `./mocks.js` at the top of the test file before calling this.
 */
export function useServerHarness(): ServerHarness {
  const tempDir = mkdtempSync(join(tmpdir(), "circled-server-test-"));
  const dbPath = join(tempDir, "circled-store.db");

  const harness = {
    baseUrl: "",
    store: null as unknown as ServerHarness["store"],
    browserCrypto: null as unknown as ServerHarness["browserCrypto"],
    serverCrypto: null as unknown as ServerHarness["serverCrypto"],
  };

  let closeServer: (() => Promise<void>) | null = null;

  beforeAll(async () => {
    vi.resetModules();
    process.env.NYXPAY_STORE_PATH = dbPath;
    // Never hit live Preprod from unit/integration harness
    process.env.NYXPAY_PREPROD_LIVE_SUBMIT = "0";

    const [{ app, store }, browserCrypto, serverCrypto] = await Promise.all([
      import("../index.js"),
      import("../../src/lib/crypto"),
      import("../services/crypto.js"),
    ]);

    harness.store = store;
    harness.browserCrypto = browserCrypto;
    harness.serverCrypto = serverCrypto;

    const server = app.listen(0);
    await new Promise<void>((resolve) => server.once("listening", () => resolve()));
    const port = (server.address() as AddressInfo).port;
    harness.baseUrl = `http://127.0.0.1:${port}`;
    closeServer = () =>
      new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve()))
      );
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    delete process.env.NYXPAY_STORE_PATH;
    if (closeServer) await closeServer();
    try {
      const { closeStore } = await import("../services/store.js");
      closeStore();
    } catch {
      /* ignore */
    }
    rmSync(tempDir, { recursive: true, force: true });
  });

  return harness;
}

export async function registerDeviceUser(
  harness: ServerHarness,
  overrides: {
    displayName?: string;
    documentReferenceHash?: string;
    deviceId?: string;
  } = {}
) {
  const keypair = await harness.browserCrypto.generateKeypair();
  const balanceCommitment = await harness.browserCrypto.commit(1000, "bal-1");
  const policyCommitment = await harness.browserCrypto.commit("policy-v1", "pol-1");

  const registerRes = await fetch(`${harness.baseUrl}/api/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      displayName: overrides.displayName ?? "Tester",
      documentReferenceHash: overrides.documentReferenceHash ?? `doc-${Date.now()}`,
      jurisdiction: "IN",
      deviceId: overrides.deviceId ?? "ios-test-1",
      publicKeyJwk: keypair.publicKeyJwk,
      balanceCommitment,
      policyCommitment,
      policyActive: ["T1", "T5"],
    }),
  });

  const body = (await registerRes.json()) as {
    user: {
      id: string;
      balanceCommitment: string;
      policyCommitment: string;
      credentialCommitment: string;
      pubkey: string;
      class0DeviceOnly: boolean;
    };
    kyc: { registryRoot: string; commitment: string };
    error?: string;
  };

  return { registerRes, body, keypair, balanceCommitment, policyCommitment };
}
