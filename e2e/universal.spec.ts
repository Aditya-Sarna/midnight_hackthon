/**
 * Playwright-shaped E2E covering universal adapter API gold paths.
 * Run with: npx playwright test (after `npx playwright install` if using UI).
 * Also covered by: npm run test:e2e (Vitest harness — same assertions).
 */
import { test, expect } from "@playwright/test";

const API = process.env.E2E_API_BASE || "http://127.0.0.1:8787";

test.describe("Universal adapter E2E", () => {
  test("INR → USD happy path", async ({ request }) => {
    const accounts = await request.get(`${API}/api/universal/sandbox-accounts`);
    expect(accounts.ok()).toBeTruthy();
    const { accounts: list } = await accounts.json();
    const maya = list.find((a: { preferredAsset: string }) => a.preferredAsset === "USD");

    const quote = await request.post(`${API}/api/universal/quote`, {
      data: { accountId: maya.id, amount: "5000" },
    });
    expect(quote.ok()).toBeTruthy();
    const q = await quote.json();

    const route = await request.post(`${API}/api/universal/route`, {
      data: { quoteId: q.quoteId },
    });
    expect(route.ok()).toBeTruthy();
    const r = await route.json();

    const settle = await request.post(`${API}/api/universal/sandbox-settle`, {
      data: {
        quoteId: q.quoteId,
        routeId: r.routeId,
        routeCommitment: r.routeCommitment,
      },
    });
    expect(settle.ok()).toBeTruthy();
    const s = await settle.json();
    expect(s.lifecycleState).toBe("reconciled");
    expect(s.receiptId).toBeTruthy();
  });

  test("INR → BTC happy path", async ({ request }) => {
    const accounts = await request.get(`${API}/api/universal/sandbox-accounts`);
    const { accounts: list } = await accounts.json();
    const arjun = list.find((a: { preferredAsset: string }) => a.preferredAsset === "BTC");
    const quote = await request.post(`${API}/api/universal/quote`, {
      data: { accountId: arjun.id, amount: "5000" },
    });
    const q = await quote.json();
    const route = await request.post(`${API}/api/universal/route`, {
      data: { quoteId: q.quoteId },
    });
    const r = await route.json();
    const settle = await request.post(`${API}/api/universal/sandbox-settle`, {
      data: {
        quoteId: q.quoteId,
        routeId: r.routeId,
        routeCommitment: r.routeCommitment,
      },
    });
    expect(settle.ok()).toBeTruthy();
    const s = await settle.json();
    expect(s.targetAdapter).toBe("stripe_test");
    expect(s.payment?.targetAsset || s.targetAsset).toBeTruthy();
  });

  test("tampered route fails", async ({ request }) => {
    const accounts = await request.get(`${API}/api/universal/sandbox-accounts`);
    const { accounts: list } = await accounts.json();
    const maya = list.find((a: { preferredAsset: string }) => a.preferredAsset === "USD");
    const quote = await request.post(`${API}/api/universal/quote`, {
      data: { accountId: maya.id, amount: "1000" },
    });
    const q = await quote.json();
    const route = await request.post(`${API}/api/universal/route`, {
      data: { quoteId: q.quoteId },
    });
    const r = await route.json();
    const settle = await request.post(`${API}/api/universal/sandbox-settle`, {
      data: {
        quoteId: q.quoteId,
        routeId: r.routeId,
        routeCommitment: r.routeCommitment,
        tamperRouteId: "route_switched_to_btc",
      },
    });
    expect(settle.status()).toBe(409);
    const body = await settle.json();
    expect(body.error).toMatch(/commitment mismatch/i);
  });
});
