// Áp migration lên database test (TEST_DATABASE_URL) trước khi chạy. Không xóa dữ liệu: test tự đặt mã riêng theo lần
// chạy nên chạy lặp được. Không bao giờ chạm DATABASE_URL thật.
import { execSync } from "node:child_process";
import { loadEnvFile } from "node:process";

export default function setup() {
  try {
    loadEnvFile(".env");
  } catch {}
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("Thiếu TEST_DATABASE_URL trong .env");
  if (url === process.env.DATABASE_URL) throw new Error("TEST_DATABASE_URL không được trùng DATABASE_URL");
  execSync("npx prisma migrate deploy", { stdio: "inherit", env: { ...process.env, DATABASE_URL: url } });
  process.env.DATABASE_URL = url;
}
