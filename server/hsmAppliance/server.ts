/**
 * Live merchant HSM appliance (PKCS#11 / Cloud-HSM gateway shape).
 * Keys never leave the process; only signatures are returned.
 *
 *   MERCHANT_HSM_MASTER_KEY=<64-hex> npm run hsm:appliance
 *   → http://127.0.0.1:9090  (MERCHANT_HSM_URL)
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STORE_PATH = join(__dirname, "../../data/hsm-appliance-keys.json");
const PORT = Number(process.env.HSM_APPLIANCE_PORT) || 9090;
const TOKEN = process.env.MERCHANT_HSM_TOKEN?.trim() || null;

type KeyRecord = { keyId: string; merchant_identifier: string; secretHex: string };

function masterKey(): Buffer {
  const hex = process.env.MERCHANT_HSM_MASTER_KEY?.replace(/^0x/, "");
  if (hex && /^[0-9a-fA-F]{64}$/.test(hex)) return Buffer.from(hex, "hex");
  const ephemeral = createHash("sha256").update(`hsm-appliance:${process.pid}`).digest();
  console.warn("[hsm-appliance] MERCHANT_HSM_MASTER_KEY unset — using process-ephemeral master");
  return ephemeral;
}

function seal(secret: string): string {
  const mk = masterKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", mk, iv);
  const enc = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

function open(sealed: string): string {
  const mk = masterKey();
  const buf = Buffer.from(sealed, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", mk, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

function loadStore(): Record<string, KeyRecord> {
  if (!existsSync(STORE_PATH)) return {};
  try {
    const raw = JSON.parse(readFileSync(STORE_PATH, "utf8")) as Record<
      string,
      KeyRecord & { sealed?: string }
    >;
    const out: Record<string, KeyRecord> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (v.sealed) {
        out[k] = {
          keyId: v.keyId,
          merchant_identifier: v.merchant_identifier,
          secretHex: open(v.sealed),
        };
      } else if (v.secretHex) {
        out[k] = v;
      }
    }
    return out;
  } catch {
    return {};
  }
}

function saveStore(map: Record<string, KeyRecord>) {
  mkdirSync(dirname(STORE_PATH), { recursive: true });
  const sealed: Record<string, { keyId: string; merchant_identifier: string; sealed: string }> =
    {};
  for (const [k, v] of Object.entries(map)) {
    sealed[k] = {
      keyId: v.keyId,
      merchant_identifier: v.merchant_identifier,
      sealed: seal(v.secretHex),
    };
  }
  writeFileSync(STORE_PATH, JSON.stringify(sealed, null, 2), { mode: 0o600 });
}

let keys = loadStore();

function auth(req: IncomingMessage): boolean {
  if (!TOKEN) return true;
  return (req.headers.authorization || "") === `Bearer ${TOKEN}`;
}

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://127.0.0.1:${PORT}`);
  if (url.pathname === "/health") {
    return json(res, 200, {
      ok: true,
      appliance: "circled-hsm",
      mode: "live",
      keys: Object.keys(keys).length,
      neverExportsSecrets: true,
    });
  }
  if (!auth(req)) return json(res, 401, { error: "unauthorized" });

  try {
    if (req.method === "POST" && url.pathname === "/keys/register") {
      const body = (await readBody(req)) as {
        merchant_identifier?: string;
        secret?: string;
      };
      const merchant = String(body.merchant_identifier || "");
      if (!merchant) return json(res, 400, { error: "merchant_identifier required" });
      const secretHex = body.secret
        ? Buffer.from(body.secret).toString("hex")
        : randomBytes(32).toString("hex");
      const keyId = createHash("sha256").update(`kid:${merchant}`).digest("hex").slice(0, 16);
      keys[merchant] = { keyId, merchant_identifier: merchant, secretHex };
      saveStore(keys);
      return json(res, 200, { ok: true, keyId, merchant_identifier: merchant });
    }

    if (req.method === "POST" && url.pathname === "/sign") {
      const body = (await readBody(req)) as {
        merchant_identifier?: string;
        message?: string;
      };
      const merchant = String(body.merchant_identifier || "");
      const message = String(body.message || "");
      const rec = keys[merchant];
      if (!rec) return json(res, 404, { error: "key not found — POST /keys/register first" });
      const signature = createHmac("sha256", Buffer.from(rec.secretHex, "hex"))
        .update(message)
        .digest("hex");
      return json(res, 200, { signature, keyId: rec.keyId, algorithm: "HMAC-SHA256" });
    }

    if (req.method === "POST" && url.pathname === "/verify") {
      const body = (await readBody(req)) as {
        merchant_identifier?: string;
        message?: string;
        signature?: string;
      };
      const merchant = String(body.merchant_identifier || "");
      const message = String(body.message || "");
      const signature = String(body.signature || "");
      const rec = keys[merchant];
      if (!rec) return json(res, 200, { ok: false });
      const expected = createHmac("sha256", Buffer.from(rec.secretHex, "hex"))
        .update(message)
        .digest("hex");
      try {
        const a = Buffer.from(expected, "hex");
        const b = Buffer.from(signature, "hex");
        return json(res, 200, { ok: a.length === b.length && timingSafeEqual(a, b) });
      } catch {
        return json(res, 200, { ok: false });
      }
    }

    return json(res, 404, { error: "not found" });
  } catch (e) {
    return json(res, 500, { error: e instanceof Error ? e.message : String(e) });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[hsm-appliance] live on http://127.0.0.1:${PORT}`);
  console.log(`[hsm-appliance] set MERCHANT_HSM_URL=http://127.0.0.1:${PORT}`);
  console.log(`[hsm-appliance] endpoints: /health /keys/register /sign /verify`);
});
