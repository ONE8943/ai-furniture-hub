import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["test/**/*.test.ts"],
    testTimeout: 30_000,
    env: {
      RAKUTEN_API_MOCK: "true",
      AMAZON_API_MOCK: "true",
      SCRAPE_MOCK: "true",
    },
  },
});
