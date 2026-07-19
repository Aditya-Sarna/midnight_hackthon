/**
 * Judge smoke — health + proofMode + optional universal RouteProof settle rehearsal.
 * Exit 0 on gold path; exit 2 if proof-server missing (clear skip); exit 1 on hard fail.
 */
const API = process.env.JUDGE_API ?? "http://127.0.0.1:8787";

async function getJson(path: string): Promise<unknown> {
  const res = await fetch(`${API}${path}`, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json();
}

async function postJson(path: string, body: unknown): Promise<{ status: number; json: unknown }> {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });
  return { status: res.status, json: await res.json() };
}

async function rehearseUniversal(): Promise<void> {
  const accounts = (await getJson("/api/universal/sandbox-accounts")) as {
    accounts: { id: string; preferredAsset: string }[];
  };
  const maya = accounts.accounts.find((a) => a.preferredAsset === "USD");
  if (!maya) throw new Error("Maya USD sandbox account missing");

  const q = await postJson("/api/universal/quote", {
    accountId: maya.id,
    amount: "5000",
  });
  if (q.status !== 200) throw new Error(`quote failed: ${JSON.stringify(q.json)}`);
  const quote = q.json as { quoteId: string };

  const r = await postJson("/api/universal/route", { quoteId: quote.quoteId });
  if (r.status !== 200) throw new Error(`route failed: ${JSON.stringify(r.json)}`);
  const route = r.json as { routeId: string; routeCommitment: string };

  const tamper = await postJson("/api/universal/sandbox-settle", {
    quoteId: quote.quoteId,
    routeId: route.routeId,
    routeCommitment: route.routeCommitment,
    tamperRouteId: "route_switched_to_btc",
  });
  if (tamper.status !== 409) {
    throw new Error(`tamper should 409, got ${tamper.status}`);
  }
  console.log("  tamperReject       = 409 route commitment mismatch ✓");

  const s = await postJson("/api/universal/sandbox-settle", {
    quoteId: quote.quoteId,
    routeId: route.routeId,
    routeCommitment: route.routeCommitment,
  });
  if (s.status !== 200) throw new Error(`settle failed: ${JSON.stringify(s.json)}`);
  const settle = s.json as {
    attestationGrade?: string;
    receiptId?: string;
    proofMode?: string;
    snarkDigest?: string;
  };
  console.log(`  universal.grade    = ${settle.attestationGrade}`);
  console.log(`  universal.receipt  = ${settle.receiptId}`);
  console.log(`  universal.proofMode= ${settle.proofMode}`);
  if (settle.snarkDigest) {
    console.log(`  snarkDigest        = ${settle.snarkDigest.slice(0, 24)}…`);
  }
  if (settle.attestationGrade !== "zk-proved") {
    throw new Error(`expected zk-proved on gold path, got ${settle.attestationGrade}`);
  }
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
    try {
      await rehearseUniversal();
    } catch (e) {
      console.error("FAIL: universal RouteProof rehearsal");
      console.error(e);
      process.exit(1);
    }
    console.log("PASS: gold path — midnight-proof-server + universal zk-proved settle");
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
