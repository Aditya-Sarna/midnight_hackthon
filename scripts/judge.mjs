#!/usr/bin/env node
/**
 * Gold judge path: proof-server up → wait healthy → npm run dev with SNARK preference.
 */
import { spawn, execSync } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const ROOT = new URL("..", import.meta.url).pathname;

function sh(cmd, opts = {}) {
  console.log(`\n› ${cmd}`);
  execSync(cmd, { stdio: "inherit", cwd: ROOT, ...opts });
}

async function waitProofServer(maxMs = 90_000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const res = await fetch("http://127.0.0.1:6300/version", {
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok || res.status === 404) {
        // some images expose /version; 404 still means port is up
        console.log("✓ proof-server port 6300 responding");
        return true;
      }
    } catch {
      /* retry */
    }
    try {
      const res = await fetch("http://127.0.0.1:6300/", {
        signal: AbortSignal.timeout(2000),
      });
      if (res.status > 0) {
        console.log("✓ proof-server port 6300 responding");
        return true;
      }
    } catch {
      /* retry */
    }
    process.stdout.write(".");
    await sleep(2000);
  }
  return false;
}

async function main() {
  console.log("Circle judge — gold path (proof-server SNARKs)");
  try {
    sh("npm run proof-server:up");
  } catch (e) {
    console.error("\nFailed to start proof-server. Is Docker Desktop running?");
    process.exit(1);
  }

  process.stdout.write("Waiting for proof-server");
  const ok = await waitProofServer();
  if (!ok) {
    console.error("\nProof-server did not become ready in time.");
    process.exit(1);
  }

  const env = {
    ...process.env,
    NYXPAY_ALLOW_DEMO_SEED: "1",
    NYXPAY_ALLOW_EPHEMERAL_KEK: "1",
    NYXPAY_ALLOW_STUB_RAILS: "1",
    NYXPAY_REQUIRE_ONCHAIN: "0",
    // Prefer SNARKs when server is up; settle still works if probe flakes
    NYXPAY_REQUIRE_ZK_PROVE: process.env.NYXPAY_REQUIRE_ZK_PROVE ?? "0",
  };

  console.log("\nStarting app + API (http://localhost:5173 · :8787)");
  console.log("Follow JUDGE.md for the 3-minute script.\n");

  const child = spawn("npm", ["run", "dev"], {
    cwd: ROOT,
    env,
    stdio: "inherit",
    shell: true,
  });

  child.on("exit", (code) => process.exit(code ?? 0));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
