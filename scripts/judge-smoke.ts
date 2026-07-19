/**
 * Judge smoke — health + proofMode (+ optional settle grade when fixtures exist).
 * Exit 0 on gold path; exit 2 if proof-server missing (clear skip); exit 1 on hard fail.
 */
const API = process.env.JUDGE_API ?? "http://127.0.0.1:8787";

async function getJson(path: string): Promise<unknown> {
  const res = await fetch(`${API}${path}`, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json();
}

async function main() {
  console.log(`judge:smoke → ${API}`);

  let health: {
    ok?: boolean;
    proofMode?: {
      mode?: string;
      proofServerOk?: boolean;
      artifactsOk?: boolean;
      detail?: string;
      proverKeysLoaded?: string[];
    };
  };
  try {
    health = (await getJson("/api/health")) as typeof health;
  } catch (e) {
    console.error("API not reachable. Run `npm run judge` or `npm run dev` first.");
    console.error(e);
    process.exit(1);
  }

  const mode = health.proofMode?.mode ?? "unknown";
  const proofServerOk = Boolean(health.proofMode?.proofServerOk);
  const artifactsOk = Boolean(health.proofMode?.artifactsOk);

  console.log(`  health.ok          = ${health.ok}`);
  console.log(`  proofMode.mode     = ${mode}`);
  console.log(`  proofServerOk      = ${proofServerOk}`);
  console.log(`  artifactsOk        = ${artifactsOk}`);
  console.log(`  detail             = ${health.proofMode?.detail ?? ""}`);

  if (!artifactsOk) {
    console.error("FAIL: Compact artifacts missing — npm run compact:compile");
    process.exit(1);
  }

  if (mode === "midnight-proof-server" && proofServerOk) {
    console.log("PASS: gold path — midnight-proof-server (expect grade zk-proved on settle)");
    process.exit(0);
  }

  if (mode === "compact-runtime" && artifactsOk) {
    console.warn("SKIP/SOFT: compact-runtime only (proof-server not live).");
    console.warn("  Start gold path: npm run judge");
    process.exit(2);
  }

  console.error(`FAIL: unexpected proof mode ${mode}`);
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
