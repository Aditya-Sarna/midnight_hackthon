import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";

export function sha256(input: string | Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}

export function commit(value: string | number, nonce: string): string {
  return sha256(`nyx:commit:${value}:${nonce}`);
}

export function randomNonce(bytes = 16): string {
  return randomBytes(bytes).toString("hex");
}

export function hmacSign(secret: string, message: string): string {
  return createHmac("sha256", secret).update(message).digest("hex");
}

export function hmacVerify(secret: string, message: string, sig: string): boolean {
  const expected = hmacSign(secret, message);
  try {
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(sig, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function timingSafeEqual(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a[i] ^ b[i];
  return out === 0;
}

export function hashPair(a: string, b: string): string {
  return sha256(a <= b ? `L:${a}|R:${b}` : `L:${b}|R:${a}`);
}

export function merkleRoot(leaves: string[]): string {
  if (leaves.length === 0) return sha256("nyx:empty");
  let level = [...leaves];
  while (level.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = level[i + 1] ?? left;
      next.push(hashPair(left, right));
    }
    level = next;
  }
  return level[0];
}

export function merkleProof(leaves: string[], index: number): string[] {
  const proof: string[] = [];
  let level = [...leaves];
  let idx = index;
  while (level.length > 1) {
    const sibling = idx % 2 === 0 ? level[idx + 1] ?? level[idx] : level[idx - 1];
    proof.push(sibling);
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      next.push(hashPair(level[i], level[i + 1] ?? level[i]));
    }
    level = next;
    idx = Math.floor(idx / 2);
  }
  return proof;
}

export function verifyMerkle(leaf: string, proof: string[], root: string): boolean {
  let h = leaf;
  for (const sibling of proof) h = hashPair(h, sibling);
  return h === root;
}

/* ——— AES-256-GCM vault encryption ——— */
export function encryptBundle(plaintext: string, keyHex: string): string {
  const key = Buffer.from(keyHex.slice(0, 64).padEnd(64, "0"), "hex").subarray(0, 32);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptBundle(ciphertext: string, keyHex: string): string {
  const key = Buffer.from(keyHex.slice(0, 64).padEnd(64, "0"), "hex").subarray(0, 32);
  const buf = Buffer.from(ciphertext, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

/* ——— Shamir SSS over GF(2^8) — AES poly, generator 0x03 ——— */
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    // multiply by primitive generator 0x03
    x = gfMulRaw(x, 0x03);
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
  GF_LOG[0] = 0;
})();

function gfMulRaw(a: number, b: number): number {
  let p = 0;
  a &= 0xff;
  b &= 0xff;
  for (let i = 0; i < 8; i++) {
    if (b & 1) p ^= a;
    const hi = a & 0x80;
    a = (a << 1) & 0xff;
    if (hi) a ^= 0x1b;
    b >>= 1;
  }
  return p;
}

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function gfDiv(a: number, b: number): number {
  if (b === 0) throw new Error("GF division by zero");
  if (a === 0) return 0;
  return GF_EXP[(GF_LOG[a] + 255 - GF_LOG[b]) % 255];
}

function evalPoly(coeffs: number[], x: number): number {
  let y = 0;
  for (let i = coeffs.length - 1; i >= 0; i--) {
    y = gfMul(y, x) ^ coeffs[i];
  }
  return y;
}

export function splitSecret(secretHex: string, n: number, t: number): string[] {
  if (t < 2 || n < t || n > 255) throw new Error("Invalid Shamir parameters");
  const secret = Buffer.from(secretHex, "hex");
  const shares: { x: number; y: number[] }[] = Array.from({ length: n }, (_, i) => ({
    x: i + 1,
    y: [] as number[],
  }));

  for (let bi = 0; bi < secret.length; bi++) {
    const coeffs = [secret[bi]];
    for (let i = 1; i < t; i++) coeffs.push(randomBytes(1)[0]);
    for (let i = 0; i < n; i++) {
      shares[i].y.push(evalPoly(coeffs, shares[i].x));
    }
  }

  return shares.map((s) => `${s.x}:${Buffer.from(s.y).toString("hex")}`);
}

export function reconstructSecret(shareStrs: string[], t: number): string {
  if (shareStrs.length < t) throw new Error("Insufficient shares");
  const parts = shareStrs.slice(0, t).map((s) => {
    const [xs, hex] = s.split(":");
    return { x: Number(xs), y: [...Buffer.from(hex, "hex")] };
  });
  const len = parts[0].y.length;
  const out = Buffer.alloc(len);

  for (let bi = 0; bi < len; bi++) {
    let secret = 0;
    for (let i = 0; i < t; i++) {
      let num = 1;
      let den = 1;
      for (let j = 0; j < t; j++) {
        if (i === j) continue;
        num = gfMul(num, parts[j].x);
        den = gfMul(den, parts[i].x ^ parts[j].x);
      }
      secret ^= gfMul(parts[i].y[bi], gfDiv(num, den));
    }
    out[bi] = secret;
  }
  return out.toString("hex");
}

/** Server-side intent-binding transcript — Compact execution is authoritative */
export function makeProof(kind: string, publicInputs: Record<string, string>, privateDigest: string) {
  const transcript = sha256(
    JSON.stringify({ kind, publicInputs, privateDigest, v: "circled-v4-intent" })
  );
  return {
    protocol: "circled-intent-binding/1",
    circuit: kind,
    publicInputs,
    proof: transcript,
    verified: false as const,
    grade: "client_intent_binding" as const,
    generatedAt: Date.now(),
  };
}
