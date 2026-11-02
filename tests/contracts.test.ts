// Test hợp đồng các điểm cắm tích hợp thật (Phase 11.4, docs/deploy-checklist.md). Mỗi điểm cắm có:
//  (1) phần LUÔN chạy: khung thật khi thiếu cấu hình trả 501 có hướng dẫn, không gọi mạng — demo không thể vô tình chạy thật;
//  (2) phần chạy THẬT khi có khóa (skipIf) — Phase 12 điền khóa rồi chạy để xác minh.
import { describe, expect, it } from "vitest";
import { sourceFor } from "@/adapters/connectors/registry";
import { AnthropicLlm } from "@/adapters/llm/anthropic";
import { getLlm } from "@/adapters/llm";
import { getPurchasing } from "@/adapters/purchasing";
import { warehouseFor } from "@/adapters/warehouse";
import { enqueueOutbox } from "@/lib/notify";

const env = (k: string, v: string | undefined, fn: () => unknown) => {
  const old = process.env[k];
  if (v === undefined) delete process.env[k]; else process.env[k] = v;
  try { return fn(); } finally { if (old === undefined) delete process.env[k]; else process.env[k] = old; }
};

describe("Điểm cắm thật — hành vi khi chưa bật (luôn chạy)", () => {
  it("Pancake / Shopify chế độ live: 501, nêu mức xác minh, không gọi mạng", async () => {
    for (const platform of ["pancake", "shopify"]) {
      await expect(sourceFor({ mode: "live", platform }, "X").fetch(new Date(0), new Date())).rejects.toMatchObject({ status: 501, message: expect.stringMatching(/chưa bật.*mức xác minh (CXM|TL)/) });
    }
    await expect(Promise.resolve().then(() => sourceFor({ mode: "live", platform: "tiktok" }, "X"))).rejects.toMatchObject({ status: 400 }); // nền tảng chưa đăng ký adapter
  });
  it("LLM: mặc định replay; Anthropic thiếu khóa → 501", async () => {
    expect(env("LLM_PROVIDER", undefined, () => getLlm().constructor.name)).toBe("ReplayLlm");
    await env("ANTHROPIC_API_KEY", undefined, () => expect(new AnthropicLlm().complete("assistant", { system: "x", prompt: "hi" })).rejects.toMatchObject({ status: 501 }));
  });
  it("Purchasing: fixture mặc định; PURCHASING_LINK=api → 501", async () => {
    expect((await env("PURCHASING_LINK", undefined, () => getPurchasing().items(["LUMI-LAMP01-WH"])) as Map<string, unknown>).size).toBe(1);
    await env("PURCHASING_LINK", "api", () => expect(getPurchasing().items(["X"])).rejects.toMatchObject({ status: 501 }));
  });
  it("BigQuery: thiếu credentials → 501", async () => {
    await expect(warehouseFor("bigquery").read("SELECT 1", {})).rejects.toMatchObject({ status: 501 });
  });
  it("Gửi ra ngoài: EXTERNAL_WRITES_ENABLED khác true → SIMULATED, không có đường gửi thật", async () => {
    const rows: { status: string }[] = [];
    const client = { outbox: { createMany: async ({ data }: { data: { status: string }[] }) => (rows.push(...data), { count: 1 }) }, notification: {} } as never;
    await env("EXTERNAL_WRITES_ENABLED", "false", () => enqueueOutbox(client, { channel: "EMAIL", recipient: "a@x.invalid", body: "x", key: "k1" }));
    await env("EXTERNAL_WRITES_ENABLED", undefined, () => enqueueOutbox(client, { channel: "EMAIL", recipient: "a@x.invalid", body: "x", key: "k2" }));
    expect(rows.map((r) => r.status)).toEqual(["SIMULATED", "SIMULATED"]);
  });
});

describe("Điểm cắm thật — chạy khi có khóa (Phase 12)", () => {
  it.skipIf(!process.env.PANCAKE_API_KEY)("Pancake: backfill 1 shop 7 ngày trả ≥ 1 bản ghi và parse đúng schema", async () => {
    const recs = await sourceFor({ mode: "live", platform: "pancake" }, process.env.PANCAKE_TEST_SHOP ?? "").fetch(new Date(Date.now() - 7 * 86_400_000), new Date());
    expect(recs.length).toBeGreaterThan(0);
  });
  it.skipIf(!process.env.SHOPIFY_ACCESS_TOKEN)("Shopify: backfill 60 ngày trả ≥ 1 bản ghi", async () => {
    const recs = await sourceFor({ mode: "live", platform: "shopify" }, process.env.SHOPIFY_SHOP ?? "").fetch(new Date(Date.now() - 60 * 86_400_000), new Date());
    expect(recs.length).toBeGreaterThan(0);
  });
  it.skipIf(!process.env.ANTHROPIC_API_KEY)("Anthropic: một câu ngắn trả văn bản + token", async () => {
    const r = await new AnthropicLlm().complete("assistant", { system: "Trả lời một từ.", prompt: "Xin chào" });
    expect(JSON.stringify(r).length).toBeGreaterThan(10);
  });
  it.skipIf(!process.env.PURCHASING_API_URL)("Purchasing: đọc 1 SKU có giá vốn + tồn", async () => {
    const m = await env("PURCHASING_LINK", "api", () => getPurchasing().items([process.env.PURCHASING_TEST_SKU ?? ""])) as Map<string, unknown>;
    expect(m.size).toBe(1);
  });
});
