// Bảng giá USD / 1 triệu token (vào, ra). Nguồn: bảng giá Anthropic API (bản lưu 06/10/2026) — đổi được qua Setting `aiPricing` từng team.
// replay = 0 (không gọi nhà cung cấp). Model lạ không có giá → 0 và ghi chú, không đoán.
import { Prisma } from "@prisma/client";

export type Price = { input: number; output: number };
export const DEFAULT_PRICES: Record<string, Price> = {
  replay: { input: 0, output: 0 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
  "claude-opus-5-5": { input: 4, output: 20 },
};

export function costUsd(model: string, inputTokens: number, outputTokens: number, prices: Record<string, Price> = DEFAULT_PRICES) {
  const p = prices[model] ?? { input: 0, output: 0 };
  return new Prisma.Decimal(inputTokens).mul(p.input).add(new Prisma.Decimal(outputTokens).mul(p.output)).div(1_000_000).toDecimalPlaces(6);
}
