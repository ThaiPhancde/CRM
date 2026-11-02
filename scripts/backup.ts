// Sao lưu DB demo (Phase 11.1): `npm run backup` → backups/<db>-<YYYYMMDD-HHmm>.dump (pg_dump định dạng custom, khôi phục bằng pg_restore).
// Mật khẩu chuyển qua biến môi trường PGPASSWORD cho tiến trình con — không đặt trên dòng lệnh, không in ra. backups/ đã gitignore.
// Tìm pg_dump: PG_BIN → PATH → thư mục cài PostgreSQL thường gặp trên Windows.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const url = new URL(process.env.DATABASE_URL ?? "");
if (!url.pathname || url.protocol !== "postgresql:" && url.protocol !== "postgres:") throw new Error("Thiếu DATABASE_URL PostgreSQL");
const dbName = decodeURIComponent(url.pathname.slice(1));
const exe = process.platform === "win32" ? "pg_dump.exe" : "pg_dump";

function findPgDump(): string {
  if (process.env.PG_BIN && existsSync(path.join(process.env.PG_BIN, exe))) return path.join(process.env.PG_BIN, exe);
  if (spawnSync(exe, ["--version"]).status === 0) return exe;
  for (const root of ["C:\\Program Files\\PostgreSQL", "D:\\PostgreSQL", "/usr/lib/postgresql"]) {
    if (!existsSync(root)) continue;
    for (const v of readdirSync(root).sort().reverse()) if (existsSync(path.join(root, v, "bin", exe))) return path.join(root, v, "bin", exe);
  }
  throw new Error("Không tìm thấy pg_dump — đặt PG_BIN tới thư mục bin của PostgreSQL");
}

const stamp = new Date().toISOString().slice(0, 16).replace(/[-:]/g, "").replace("T", "-");
mkdirSync("backups", { recursive: true });
const out = path.join("backups", `${dbName}-${stamp}.dump`);
const r = spawnSync(findPgDump(), ["-Fc", "-h", url.hostname, "-p", url.port || "5432", "-U", decodeURIComponent(url.username), "-d", dbName, "-f", out], {
  env: { ...process.env, PGPASSWORD: decodeURIComponent(url.password) }, stdio: ["ignore", "inherit", "inherit"],
});
if (r.status !== 0) throw new Error(`pg_dump thất bại (mã ${r.status})`);
console.log(`Đã sao lưu ${dbName} → ${out} (${Math.round(statSync(out).size / 1024)} KB). Khôi phục: pg_restore -c -d ${dbName} ${out}`);
