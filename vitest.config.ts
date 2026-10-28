import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    include: ["tests/**/*.test.ts"],
    // Test tích hợp dùng chung một database test → chạy tuần tự.
    fileParallelism: false,
    globalSetup: ["tests/global-setup.ts"],
    env: { SESSION_SECRET: "test-secret-test-secret-test-secret-123" },
  },
});
