// E2E smoke (Phase 11.3): đi theo docs/demo-script.md trên DB demo + kiểm quy tắc giao diện. Chạy: `npm run e2e`
// (tự `next start` cổng 3219 — cần `next build` trước; hoặc trỏ E2E_BASE_URL tới server đang chạy). Dùng Chrome của máy (không tải trình duyệt).
import { defineConfig } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3219";
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 2,
  reporter: [["list"]],
  outputDir: "tests/e2e/shots",
  use: { baseURL, channel: "chrome", headless: true, viewport: { width: 1440, height: 900 }, screenshot: "only-on-failure", locale: "vi-VN" },
  // `.next` phải là bản build sạch: build chồng lên thư mục dev server đã dùng làm `next start` lỗi "reading 'call'" → `rm -rf .next && next build`.
  webServer: process.env.E2E_BASE_URL ? undefined : { command: "npx next start -p 3219", url: baseURL, reuseExistingServer: true, timeout: 120_000 },
});
