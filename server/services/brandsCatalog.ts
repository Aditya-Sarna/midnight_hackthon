/**
 * Popular-brand catalog (1000) with registered vs unverified classification.
 * Registered brands are also enrolled in the a26z verified-merchant registry.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Store } from "./store.js";
import { ensureDemoBrandRegistries, resolveMerchant } from "./verifiedMerchant.js";
import { merkleRoot, randomNonce, sha256 } from "./crypto.js";
import { sealSecret } from "./secretBox.js";
import { saveStore } from "./store.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CATALOG_PATH = join(__dirname, "../../data/brands-catalog.json");

export type BrandRecord = {
  id: string;
  name: string;
  domain: string;
  category: string;
  registered: boolean;
  aliases: string[];
};

type CatalogFile = {
  version: number;
  total: number;
  registeredCount: number;
  brands: BrandRecord[];
};

let cached: CatalogFile | null = null;

export function loadBrandsCatalog(): CatalogFile {
  if (cached) return cached;
  if (!existsSync(CATALOG_PATH)) {
    cached = { version: 1, total: 0, registeredCount: 0, brands: [] };
    return cached;
  }
  cached = JSON.parse(readFileSync(CATALOG_PATH, "utf8")) as CatalogFile;
  return cached;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9.]+/g, "")
    .trim();
}

export function lookupBrand(query: string): BrandRecord | null {
  const q = normalize(query);
  if (!q) return null;
  const { brands } = loadBrandsCatalog();
  // Exact domain / alias / name match first
  for (const b of brands) {
    if (normalize(b.domain) === q) return b;
    if (normalize(b.name) === q) return b;
    if (b.aliases.some((a) => normalize(a) === q)) return b;
  }
  // Starts-with / contains for short queries
  if (q.length >= 3) {
    const hit = brands.find(
      (b) =>
        normalize(b.name).startsWith(q) ||
        normalize(b.domain).startsWith(q) ||
        b.aliases.some((a) => normalize(a).startsWith(q))
    );
    if (hit) return hit;
  }
  return null;
}

export type BrandLookupResult = {
  found: boolean;
  isBrand: boolean;
  registered: boolean;
  brand: BrandRecord | null;
  logoUrl: string | null;
  merchant_identifier: string | null;
  payment_address: string | null;
  message: string;
  status: "verified" | "unverified_brand" | "not_a_brand";
};

export function classifyRecipient(store: Store, recipient: string): BrandLookupResult {
  ensureDemoBrandRegistries(store);
  ensureRegisteredBrandsInRegistry(store);

  const brand = lookupBrand(recipient);
  if (!brand) {
    return {
      found: false,
      isBrand: false,
      registered: false,
      brand: null,
      logoUrl: null,
      merchant_identifier: null,
      payment_address: null,
      status: "not_a_brand",
      message: "Personal / unknown payee — not in the brand catalog.",
    };
  }

  const logoUrl = `https://logo.clearbit.com/${brand.domain}`;
  if (!brand.registered) {
    return {
      found: true,
      isBrand: true,
      registered: false,
      brand,
      logoUrl,
      merchant_identifier: brand.domain,
      payment_address: null,
      status: "unverified_brand",
      message: `${brand.name} is not a verified merchant on Circled. This is not a verified payment.`,
    };
  }

  const resolved = resolveMerchant(store, brand.domain);
  const payment_address = resolved?.leaf.paymentAddresses[0] ?? null;

  return {
    found: true,
    isBrand: true,
    registered: true,
    brand,
    logoUrl,
    merchant_identifier: brand.domain,
    payment_address,
    status: "verified",
    message: `${brand.name} is a verified merchant — payment address bound in brand registry.`,
  };
}

/** Enroll every catalog-registered brand into the a26z merchant leaf set (once). */
export function ensureRegisteredBrandsInRegistry(store: Store) {
  ensureDemoBrandRegistries(store);
  if (!store.brandRegistries) store.brandRegistries = {};
  if (!store.merchantLeaves) store.merchantLeaves = [];

  const existing = new Set(store.merchantLeaves.map((m) => m.identifier));
  const { brands } = loadBrandsCatalog();
  let added = 0;

  for (const b of brands.filter((x) => x.registered)) {
    const id = b.domain.toLowerCase();
    if (existing.has(id)) continue;

    const brandId = id.replace(/\./g, "_").slice(0, 32);
    if (!store.brandRegistries[brandId]) {
      store.brandRegistries[brandId] = {
        brandId,
        brandName: b.name,
        root: sha256("empty"),
        merchantIdentifiers: [],
      };
    }

    const vendorSecretPlain = randomNonce(32);
    const vendorPubkey = sha256(`vendorpk:${brandId}:${id}`);
    const leaf = sha256(`a26z:vendor:${brandId}|${id}|${vendorPubkey}`);
    const nullifier = sha256(`vendor-nf:${leaf}`);
    const paymentAddress = `0x${sha256(`payaddr:${id}`).slice(0, 40)}`;

    store.merchantLeaves.push({
      identifier: id,
      displayName: b.name,
      brandId,
      vendorSecret: sealSecret(vendorSecretPlain),
      vendorPubkey,
      paymentAddresses: [paymentAddress],
      leaf,
      nullifier,
      revoked: false,
    });
    existing.add(id);
    added += 1;

    const leaves = store.merchantLeaves
      .filter((m) => m.brandId === brandId && !m.revoked)
      .map((m) => m.leaf);
    store.brandRegistries[brandId].root = merkleRoot(
      leaves.length ? leaves : [sha256(`empty-brand:${brandId}`)]
    );
    store.brandRegistries[brandId].merchantIdentifiers = store.merchantLeaves
      .filter((m) => m.brandId === brandId && !m.revoked)
      .map((m) => m.identifier);
  }

  if (added > 0) saveStore(store);
  return added;
}

export function catalogStats() {
  const c = loadBrandsCatalog();
  return {
    total: c.total,
    registeredCount: c.registeredCount,
    unregisteredCount: c.total - c.registeredCount,
  };
}
