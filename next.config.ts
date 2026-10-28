import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Dev: bỏ qua thư mục do công cụ ghi (log Playwright, ảnh chụp, tài liệu, job Gemini) để không biên dịch lại liên tục.
  webpack(config, { dev }) {
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: ["**/node_modules/**", "**/.git/**", "**/.next*/**", "**/.playwright-mcp/**", "**/tests/e2e/shots/**", "**/docs/**", "**/ai-jobs/**", "**/tools/**", "**/.claude/**"],
      };
    }
    return config;
  },
};

export default nextConfig;
