/**
 * Production runtime configuration.
 * Set NYXPAY_STRICT=1 (or NODE_ENV=production) for fail-closed behavior.
 */
import { createHash, randomBytes } from "node:crypto";

export type NyxConfig = {
  nodeEnv: string;
  isProduction: boolean;
  isStrict: boolean;
  /** Reject settle unless Compact artifacts execute (and ZK prove when requireZkProve) */
  requireProofs: boolean;
  /** Require proof-server warm+prove path (not just compact-runtime) */
  requireZkProve: boolean;
  /** Require Preprod broadcast / anchor on settle */
  requireOnchain: boolean;
  port: number;
  bindHost: string;
  corsOrigins: string[] | "*";
  skillApiToken: string | null;
  merchantKek: string;
  compactLocalSk: Buffer;
  storePath: string | null;
};

function truthy(v: string | undefined): boolean {
  return v === "1" || v === "true" || v === "yes";
}

let cached: NyxConfig | null = null;

export function loadConfig(): NyxConfig {
  if (cached) return cached;
  const nodeEnv = process.env.NODE_ENV || "development";
  const isProduction = nodeEnv === "production";
  const isStrict = truthy(process.env.NYXPAY_STRICT) || isProduction;
  const requireProofs = truthy(process.env.NYXPAY_REQUIRE_PROOFS) || isStrict;
  // Production-ready default: SNARK prove required in strict unless explicitly disabled.
  // Tests / soft-boot keep compact-runtime allowed (set NYXPAY_REQUIRE_ZK_PROVE=1 to force).
  const requireZkProve =
    truthy(process.env.NYXPAY_REQUIRE_ZK_PROVE) ||
    (isStrict &&
      process.env.NYXPAY_REQUIRE_ZK_PROVE !== "0" &&
      process.env.NYXPAY_BOOT_SOFT !== "1" &&
      !process.env.VITEST);
  const requireOnchain =
    truthy(process.env.NYXPAY_REQUIRE_ONCHAIN) ||
    (isStrict && process.env.NYXPAY_REQUIRE_ONCHAIN !== "0");

  let merchantKek = process.env.MERCHANT_KEK?.trim() || "";
  if (!merchantKek) {
    if (isStrict && !process.env.VITEST && process.env.NYXPAY_ALLOW_EPHEMERAL_KEK !== "1") {
      // Derived ephemeral for boot — warn; production should set MERCHANT_KEK
      merchantKek = createHash("sha256")
        .update(`circled:kek:ephemeral:${process.pid}`)
        .digest("hex");
      console.warn(
        "[circled] MERCHANT_KEK unset — using process-ephemeral KEK (set MERCHANT_KEK for durable secret encryption)"
      );
    } else {
      merchantKek = createHash("sha256").update("circled:dev:merchant-kek").digest("hex");
    }
  }

  let compactLocalSk: Buffer;
  const skHex = process.env.COMPACT_LOCAL_SK?.replace(/^0x/, "");
  if (skHex && /^[0-9a-fA-F]{64}$/.test(skHex)) {
    compactLocalSk = Buffer.from(skHex, "hex");
  } else if (isStrict && !process.env.VITEST) {
    compactLocalSk = randomBytes(32);
    console.warn(
      "[circled] COMPACT_LOCAL_SK unset — generated ephemeral witness key for this process"
    );
  } else {
    // Deterministic only in non-strict / test (demo continuity)
    compactLocalSk = createHash("sha256").update("circled:compact:localSecretKey").digest();
  }

  const corsRaw = process.env.CORS_ORIGIN?.trim();
  const corsOrigins: string[] | "*" =
    !corsRaw || corsRaw === "*"
      ? isStrict
        ? ["http://127.0.0.1:5173", "http://localhost:5173"]
        : "*"
      : corsRaw.split(",").map((s) => s.trim()).filter(Boolean);

  cached = {
    nodeEnv,
    isProduction,
    isStrict,
    requireProofs,
    requireZkProve,
    requireOnchain,
    port: Number(process.env.PORT) || 8787,
    bindHost: process.env.BIND_HOST || (isStrict ? "127.0.0.1" : "0.0.0.0"),
    corsOrigins,
    skillApiToken: process.env.API_SKILL_TOKEN?.trim() || null,
    merchantKek,
    compactLocalSk,
    storePath: process.env.NYXPAY_STORE_PATH || null,
  };
  return cached;
}

/** Reset cache (tests) */
export function resetConfigCache() {
  cached = null;
}

/**
 * Fail-closed in strict/production unless soft-boot is explicitly enabled.
 * Throws so the process does not listen with ephemeral secrets by accident.
 */
export function assertProductionBoot() {
  const cfg = loadConfig();
  if (!cfg.isStrict) return;
  if (process.env.NYXPAY_BOOT_SOFT === "1" || process.env.VITEST) return;

  const missing: string[] = [];
  if (!process.env.MERCHANT_KEK && process.env.NYXPAY_ALLOW_EPHEMERAL_KEK !== "1") {
    missing.push("MERCHANT_KEK (or NYXPAY_ALLOW_EPHEMERAL_KEK=1 for ephemeral demo only)");
  }
  if (!process.env.COMPACT_LOCAL_SK && process.env.NYXPAY_ALLOW_EPHEMERAL_KEK !== "1") {
    missing.push("COMPACT_LOCAL_SK (or NYXPAY_ALLOW_EPHEMERAL_KEK=1)");
  }
  if (cfg.requireZkProve && !process.env.MIDNIGHT_PROOF_SERVER_URL) {
    missing.push("MIDNIGHT_PROOF_SERVER_URL");
  }
  if (cfg.isProduction && !process.env.API_SKILL_TOKEN) {
    missing.push("API_SKILL_TOKEN (required to lock /api/skills in production)");
  }
  if (missing.length) {
    throw new Error(
      `[circled] Strict boot refused — missing: ${missing.join(", ")}. ` +
        `Set NYXPAY_BOOT_SOFT=1 only for local demos.`
    );
  }
}
