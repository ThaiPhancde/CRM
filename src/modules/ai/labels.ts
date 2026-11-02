// Nhãn thuần (không import DB) cho Trung tâm AI — dùng được cả ở client.
import type { AgentRunStatus, ApprovalStatus, ToolCallStatus } from "@prisma/client";
import type { Tone } from "@/components/ui";

export const AI_FEATURES = ["summary360", "search", "conversation", "draft", "assistant", "report"] as const;
export type AiFeatureKey = (typeof AI_FEATURES)[number];
export const FEATURE_LABEL: Record<AiFeatureKey, string> = {
  summary360: "Tóm tắt khách 360", search: "Tìm tự nhiên", conversation: "Tóm tắt hội thoại", draft: "Soạn phản hồi", assistant: "Trợ lý (tạo việc/lịch hẹn)", report: "Hỏi báo cáo",
};
export const RUN_STATUS_LABEL: Record<AgentRunStatus, string> = { OK: "Thành công", NEEDS_CLARIFICATION: "Cần làm rõ", DENIED: "Bị từ chối quyền", ERROR: "Lỗi" };
export const RUN_STATUS_TONE: Record<AgentRunStatus, Tone> = { OK: "success", NEEDS_CLARIFICATION: "warning", DENIED: "danger", ERROR: "danger" };
export const TOOL_LABEL: Record<string, string> = {
  tim_khach: "Tìm khách", tim_don: "Tìm đơn", tom_tat_360: "Lấy hồ sơ 360", tao_nhiem_vu: "Tạo nhiệm vụ", tao_lich_hen: "Tạo lịch hẹn", soan_phan_hoi: "Soạn phản hồi", hoi_bao_cao: "Hỏi báo cáo",
};
export const TOOL_STATUS_LABEL: Record<ToolCallStatus, string> = { OK: "Đã chạy", DENIED: "Từ chối (thiếu quyền)", ERROR: "Lỗi", PENDING_APPROVAL: "Chờ duyệt" };
export const TOOL_STATUS_TONE: Record<ToolCallStatus, Tone> = { OK: "success", DENIED: "danger", ERROR: "danger", PENDING_APPROVAL: "warning" };
export const APPROVAL_STATUS_LABEL: Record<ApprovalStatus, string> = { PENDING: "Chờ duyệt", APPROVED: "Đã duyệt", REJECTED: "Đã từ chối" };
export const APPROVAL_STATUS_TONE: Record<ApprovalStatus, Tone> = { PENDING: "warning", APPROVED: "success", REJECTED: "neutral" };
export const REPLY_LANGUAGES = [["vi", "Tiếng Việt"], ["en", "English"], ["ar", "العربية"], ["de", "Deutsch"]].map(([value, label]) => ({ value, label }));
