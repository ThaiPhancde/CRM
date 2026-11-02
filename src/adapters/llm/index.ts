// Chọn LLM theo env: replay (mặc định, demo) | anthropic (khung Phase 12). Không có nhánh demo trong nghiệp vụ.
import { AnthropicLlm } from "./anthropic";
import type { Llm } from "./interface";
import { ReplayLlm } from "./replay";

export * from "./interface";
let cached: Llm | null = null;
export const getLlm = (): Llm => (cached ??= process.env.LLM_PROVIDER === "anthropic" ? new AnthropicLlm() : new ReplayLlm());
