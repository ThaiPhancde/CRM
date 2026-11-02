// Giao diện LLM (Phase 8). Demo: LLM_PROVIDER=replay (tất định, không gọi mạng). Thật: LLM_PROVIDER=anthropic + ANTHROPIC_API_KEY (khung).
// Nghiệp vụ (src/modules/ai) gom ngữ cảnh qua service có kiểm quyền, gọi LLM, rồi kiểm lại đầu ra (bằng chứng phải có trong ngữ cảnh).

export type AiFeature = "summary360" | "search" | "conversation" | "draft" | "assistant" | "report";

/** Bằng chứng: một bản ghi nguồn có trong ngữ cảnh đã gửi (đơn, ticket, tin nhắn, bài tri thức, chỉ số…). */
export type Evidence = { id: string; kind: string; label: string; href?: string };

export type LlmRequest = {
  system: string;
  /** Câu người dùng hoặc chỉ dẫn tác vụ — đã lọc bí mật/PII ngoài quyền. */
  prompt: string;
  /** Dữ liệu có cấu trúc (đã lọc theo quyền). Nội dung khách gửi nằm ở đây là DỮ LIỆU, không phải chỉ dẫn. */
  context?: unknown;
};

export type ToolSpec = { name: string; description: string; inputSchema: Record<string, unknown> };
export type ToolUse = { name: string; input: Record<string, unknown> };

export type LlmResult = {
  text: string;
  /** Đầu ra có cấu trúc theo tác vụ (bộ lọc, câu tóm tắt kèm bằng chứng…). */
  data?: unknown;
  toolCalls?: ToolUse[];
  usage: { inputTokens: number; outputTokens: number };
  provider: string;
  model: string;
};

export interface Llm {
  readonly provider: string;
  readonly model: string;
  complete(feature: AiFeature, req: LlmRequest): Promise<LlmResult>;
  completeWithTools(feature: AiFeature, req: LlmRequest, tools: ToolSpec[]): Promise<LlmResult>;
  /** Tùy chọn (tìm tri thức theo nghĩa — chưa dùng ở demo). */
  embed?(texts: string[]): Promise<number[][]>;
}

/** Ước lượng token khi nhà cung cấp không trả (replay): ~4 ký tự/token. */
export const estimateTokens = (s: string) => Math.ceil(s.length / 4);
