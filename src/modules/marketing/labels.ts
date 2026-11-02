// Nhãn thuần (không import DB) cho phân khúc / hành trình / chiến dịch — dùng được cả ở client.
import type { CampaignStatus, JourneyRunStatus, JourneyStatus } from "@prisma/client";
import type { Tone } from "@/components/ui";

export const STEP_TYPES = ["WAIT", "CONDITION", "STOCK_CHECK", "SEND", "TASK", "TAG", "EXIT"] as const;
export type StepType = (typeof STEP_TYPES)[number];
export const STEP_LABEL: Record<StepType, string> = { WAIT: "Chờ", CONDITION: "Điều kiện", STOCK_CHECK: "Kiểm tồn", SEND: "Gửi tin", TASK: "Tạo việc", TAG: "Gán thẻ", EXIT: "Thoát" };
export const CHANNELS = ["EMAIL", "SMS", "WHATSAPP"] as const;
export const CHANNEL_LABEL: Record<(typeof CHANNELS)[number], string> = { EMAIL: "Email", SMS: "SMS", WHATSAPP: "WhatsApp" };

export const CMP_LABEL: Record<string, string> = { eq: "bằng", neq: "khác", gt: "lớn hơn", gte: "từ", lt: "nhỏ hơn", lte: "tới", in: "thuộc", has: "có", not_has: "không có" };
/** Phép so sánh hợp lệ theo kiểu trường (khớp FIELDS ở segments.ts). */
export const CMPS_BY_TYPE: Record<"number" | "enum" | "tags" | "bool", string[]> = { number: ["gte", "lte", "gt", "lt", "eq"], enum: ["eq", "neq"], tags: ["has", "not_has"], bool: ["eq"] };

export const JOURNEY_STATUS_LABEL: Record<JourneyStatus, string> = { DRAFT: "Nháp", ACTIVE: "Đang chạy", PAUSED: "Tạm dừng" };
export const JOURNEY_STATUS_TONE: Record<JourneyStatus, Tone> = { DRAFT: "neutral", ACTIVE: "success", PAUSED: "warning" };
export const RUN_STATUS_LABEL: Record<JourneyRunStatus, string> = { RUNNING: "Đang trong hành trình", COMPLETED: "Hoàn tất", EXITED: "Đã ra" };
export const RUN_STATUS_TONE: Record<JourneyRunStatus, Tone> = { RUNNING: "brand", COMPLETED: "success", EXITED: "neutral" };
export const OUTCOME_LABEL: Record<string, string> = {
  WAITING: "Đang chờ", PASSED: "Thỏa", FAILED: "Không thỏa", IN_STOCK: "Còn hàng", OUT_OF_STOCK: "Hết hàng", SENT: "Đã gửi (giả lập)",
  SKIPPED_NO_RECIPIENT: "Bỏ qua — thiếu liên hệ", SKIPPED_NO_CONSENT: "Bỏ qua — chưa đồng ý", SKIPPED_CAP: "Bỏ qua — quá tần suất",
  TASK_CREATED: "Đã tạo việc", SKIPPED_NO_ASSIGNEE: "Bỏ qua — không có người nhận", TAGGED: "Đã gán thẻ", EXITED: "Thoát",
};
export const OUTCOME_TONE = (o: string): Tone => (o.startsWith("SKIPPED") || o === "FAILED" || o === "OUT_OF_STOCK" ? "warning" : o === "SENT" || o === "TASK_CREATED" || o === "TAGGED" ? "success" : "neutral");

export const CAMPAIGN_STATUSES = ["DRAFT", "RUNNING", "ENDED"] as const satisfies readonly CampaignStatus[];
export const CAMPAIGN_STATUS_LABEL: Record<CampaignStatus, string> = { DRAFT: "Nháp", RUNNING: "Đang chạy", ENDED: "Đã kết thúc" };
export const CAMPAIGN_STATUS_TONE: Record<CampaignStatus, Tone> = { DRAFT: "neutral", RUNNING: "success", ENDED: "info" };
export const CAMPAIGN_CHANNELS = [["EMAIL", "Email"], ["SMS", "SMS"], ["WHATSAPP", "WhatsApp"], ["FACEBOOK", "Facebook"], ["GOOGLE", "Google"], ["TIKTOK", "TikTok"], ["KHAC", "Khác"]].map(([value, label]) => ({ value, label }));
/** Khóa mẫu tin (fixtures/message-templates.json có đủ vi/en/ar/de cho mỗi khóa). */
export const TEMPLATE_KEYS = [["repurchase_reminder", "Nhắc mua lại"], ["repurchase_offer", "Ưu đãi mua lại"], ["back_in_stock", "Có hàng trở lại"], ["winback", "Mời quay lại"]].map(([value, label]) => ({ value, label }));
