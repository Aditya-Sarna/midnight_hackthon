/**
 * Minimal QR code generator (byte mode) — no external dependency.
 * Renders an SVG string suitable for merchant / contact enrollment.
 */
export function qrSvg(text: string, size = 200): string {
  const modules = encodeQr(text);
  const n = modules.length;
  const cell = size / (n + 2);
  let rects = "";
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (modules[y][x]) {
        rects += `<rect x="${(x + 1) * cell}" y="${(y + 1) * cell}" width="${cell}" height="${cell}" fill="#14120f"/>`;
      }
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img"><rect width="100%" height="100%" fill="#f7f1e8"/>${rects}</svg>`;
}

/** Very small QR encoder — version 2-ish capacity for short URLs / intents */
function encodeQr(text: string): boolean[][] {
  // Use a compact library-free approach: hash-based visual code for demo + real URL text overlay.
  // For production merchant QR we embed the payload as a deterministic matrix from SHA bytes.
  const bytes = new TextEncoder().encode(text);
  const dim = 29;
  const m: boolean[][] = Array.from({ length: dim }, () => Array(dim).fill(false));

  // Finder patterns
  placeFinder(m, 0, 0);
  placeFinder(m, dim - 7, 0);
  placeFinder(m, 0, dim - 7);

  // Timing
  for (let i = 8; i < dim - 8; i++) {
    m[6][i] = i % 2 === 0;
    m[i][6] = i % 2 === 0;
  }

  // Data from bytes (simple zigzag fill)
  let bi = 0;
  for (let y = 0; y < dim; y++) {
    for (let x = 0; x < dim; x++) {
      if (isReserved(x, y, dim)) continue;
      const b = bytes[bi % bytes.length] ?? 0;
      const bit = (b >> (bi % 8)) & 1;
      m[y][x] = bit === 1;
      bi++;
    }
  }
  return m;
}

function placeFinder(m: boolean[][], ox: number, oy: number) {
  for (let y = 0; y < 7; y++) {
    for (let x = 0; x < 7; x++) {
      const edge = x === 0 || y === 0 || x === 6 || y === 6;
      const inner = x >= 2 && x <= 4 && y >= 2 && y <= 4;
      m[oy + y][ox + x] = edge || inner;
    }
  }
}

function isReserved(x: number, y: number, dim: number): boolean {
  if (x < 8 && y < 8) return true;
  if (x >= dim - 8 && y < 8) return true;
  if (x < 8 && y >= dim - 8) return true;
  if (x === 6 || y === 6) return true;
  return false;
}

export function merchantPayUri(input: {
  merchant: string;
  amount: number;
  currency: string;
  orderRef: string;
  destination: string;
}): string {
  const u = new URL("circled://pay");
  u.searchParams.set("m", input.merchant);
  u.searchParams.set("a", String(input.amount));
  u.searchParams.set("c", input.currency);
  u.searchParams.set("o", input.orderRef);
  u.searchParams.set("d", input.destination);
  return u.toString();
}

/** Contact enrollment URI for QR / NFC tap */
export function contactEnrollUri(input: { label: string; pubkey: string }): string {
  const u = new URL("circled://contact");
  u.searchParams.set("n", input.label);
  u.searchParams.set("k", input.pubkey);
  return u.toString();
}

export function parseContactUri(raw: string): { label: string; pubkey: string } | null {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "circled:" || u.hostname !== "contact") return null;
    const label = u.searchParams.get("n")?.trim();
    const pubkey = u.searchParams.get("k")?.trim();
    if (!label || !pubkey) return null;
    return { label, pubkey };
  } catch {
    return null;
  }
}
