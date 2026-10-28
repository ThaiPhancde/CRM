// Mã hóa cấu hình kết nối (khóa API) bằng AES-256-GCM, khóa lấy từ INTEGRATION_SECRET_KEY (stdlib, không thêm thư viện).
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function key() {
  const s = process.env.INTEGRATION_SECRET_KEY;
  if (!s || s.length < 32) throw new Error("INTEGRATION_SECRET_KEY phải có ít nhất 32 ký tự để lưu khóa kết nối");
  return createHash("sha256").update(s).digest();
}

export function encryptJson(value: unknown): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([c.update(JSON.stringify(value), "utf8"), c.final()]);
  return ["v1", iv.toString("base64"), c.getAuthTag().toString("base64"), body.toString("base64")].join(".");
}

export function decryptJson<T>(token: string): T {
  const [v, iv, tag, body] = token.split(".");
  if (v !== "v1") throw new Error("Định dạng cấu hình mã hóa không hỗ trợ");
  const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  d.setAuthTag(Buffer.from(tag, "base64"));
  return JSON.parse(Buffer.concat([d.update(Buffer.from(body, "base64")), d.final()]).toString("utf8")) as T;
}
