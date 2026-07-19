import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Server integration tests set NYXPAY_STORE_PATH + resetModules; serialize files.
    fileParallelism: false,
    pool: "forks",
    // Playwright specs live under e2e/ — run via `npm run test:e2e:playwright`.
    exclude: ["**/node_modules/**", "**/dist/**", "e2e/**"],
  },
});
