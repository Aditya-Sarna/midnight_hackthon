import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Server integration tests set NYXPAY_STORE_PATH + resetModules; serialize files.
    fileParallelism: false,
    pool: "forks",
  },
});
