/**
 * Enterprise merchant signing — secrets never leave the HSM boundary.
 * Modes:
 *  - software: SoftHSM unwraps sealed key only inside sign()
 *  - external: live appliance at MERCHANT_HSM_URL (npm run hsm:appliance)
 * Strict + MERCHANT_HSM_URL → external required; auto-prove disabled.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { loadConfig } from "../config.js";
import { openSecret } from "./secretBox.js";

export type MerchantSignRequest = {
  merchant_identifier: string;
  sealed_secret?: string;
  message: string;
};

export type MerchantSigner = {
  mode: "software" | "external";
  sign(req: MerchantSignRequest): Promise<string>;
  verify(req: MerchantSignRequest, signature: string): Promise<boolean>;
  health?(): Promise<{ ok: boolean; detail: string }>;
};

class SoftHsmSigner implements MerchantSigner {
  mode = "software" as const;

  async sign(req: MerchantSignRequest): Promise<string> {
    if (!req.sealed_secret) throw new Error("SoftHSM requires sealed_secret");
    const key = openSecret(req.sealed_secret);
    return createHmac("sha256", key).update(req.message).digest("hex");
  }

  async verify(req: MerchantSignRequest, signature: string): Promise<boolean> {
    const expected = await this.sign(req);
    try {
      const a = Buffer.from(expected, "hex");
      const b = Buffer.from(signature, "hex");
      return a.length === b.length && timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  async health() {
    return { ok: true, detail: "SoftHSM in-process (demo); use MERCHANT_HSM_URL for live appliance" };
  }
}

class ExternalHsmSigner implements MerchantSigner {
  mode = "external" as const;
  constructor(
    private url: string,
    private token: string | null
  ) {}

  private headers(): Record<string, string> {
    return {
      "content-type": "application/json",
      ...(this.token ? { authorization: `Bearer ${this.token}` } : {}),
    };
  }

  async health(): Promise<{ ok: boolean; detail: string }> {
    try {
      const res = await fetch(`${this.url.replace(/\/$/, "")}/health`, {
        signal: AbortSignal.timeout(5_000),
      });
      if (!res.ok) return { ok: false, detail: `HSM health ${res.status}` };
      const data = (await res.json()) as { ok?: boolean; appliance?: string; neverExportsSecrets?: boolean };
      if (!data.ok || data.neverExportsSecrets === false) {
        return { ok: false, detail: "HSM appliance unhealthy or exports secrets" };
      }
      return { ok: true, detail: `live appliance ${data.appliance || this.url}` };
    } catch (e) {
      return { ok: false, detail: e instanceof Error ? e.message : String(e) };
    }
  }

  async sign(req: MerchantSignRequest): Promise<string> {
    const res = await fetch(`${this.url.replace(/\/$/, "")}/sign`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        merchant_identifier: req.merchant_identifier,
        message: req.message,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      throw new Error(`External HSM sign failed: ${res.status}`);
    }
    const data = (await res.json()) as { signature?: string };
    if (!data.signature) throw new Error("External HSM returned no signature");
    return data.signature;
  }

  async verify(req: MerchantSignRequest, signature: string): Promise<boolean> {
    const res = await fetch(`${this.url.replace(/\/$/, "")}/verify`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        merchant_identifier: req.merchant_identifier,
        message: req.message,
        signature,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { ok?: boolean };
    return Boolean(data.ok);
  }

  /** Provision key inside appliance (never returns secret) */
  async registerKey(merchant_identifier: string, secret?: string): Promise<string> {
    const res = await fetch(`${this.url.replace(/\/$/, "")}/keys/register`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ merchant_identifier, secret }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`HSM register failed: ${res.status}`);
    const data = (await res.json()) as { keyId?: string };
    if (!data.keyId) throw new Error("HSM register returned no keyId");
    return data.keyId;
  }
}

let signer: MerchantSigner | null = null;
let signerKey: string | null = null;

function signerCacheKey(): string {
  return `${process.env.NYXPAY_MERCHANT_SIGNING || ""}|${process.env.MERCHANT_HSM_URL || ""}`;
}

export function getMerchantSigner(): MerchantSigner {
  const key = signerCacheKey();
  if (signer && signerKey === key) return signer;
  const mode = (process.env.NYXPAY_MERCHANT_SIGNING || "").toLowerCase();
  const url = process.env.MERCHANT_HSM_URL?.trim();

  // Live appliance when URL set (unless forced software) or mode=external
  if (mode === "external" || (url && mode !== "software")) {
    if (!url) {
      throw new Error(
        "NYXPAY_MERCHANT_SIGNING=external requires MERCHANT_HSM_URL (npm run hsm:appliance)"
      );
    }
    signer = new ExternalHsmSigner(url, process.env.MERCHANT_HSM_TOKEN?.trim() || null);
    signerKey = key;
    return signer;
  }

  // SoftHSM default — still valid under strict; auto-prove remains disabled
  signer = new SoftHsmSigner();
  signerKey = key;
  return signer;
}

export function resetMerchantSigner() {
  signer = null;
  signerKey = null;
}

export async function probeMerchantHsm(): Promise<{
  mode: string;
  ok: boolean;
  detail: string;
}> {
  try {
    const s = getMerchantSigner();
    const h = s.health ? await s.health() : { ok: true, detail: s.mode };
    return { mode: s.mode, ok: h.ok, detail: h.detail };
  } catch (e) {
    return {
      mode: "unavailable",
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    };
  }
}

/** Strict / production: refuse to auto-prove merchant credentials server-side */
export function allowMerchantAutoProve(): boolean {
  const cfg = loadConfig();
  if (process.env.NYXPAY_ALLOW_MERCHANT_AUTO_PROVE === "1") return true;
  if (cfg.isStrict) return false;
  if (process.env.MERCHANT_HSM_URL?.trim()) return false;
  return process.env.NYXPAY_MERCHANT_SIGNING !== "external";
}
