// Nhãn thuần (không import DB) cho ticket/tri thức — dùng được cả ở client.
import type { TicketPriority, TicketStatus, TicketType } from "@prisma/client";
import type { Tone } from "@/components/ui";

export const TICKET_TYPES = ["GIAO_CHAM", "LOI_HANG", "DOI_TRA", "BAO_HANH", "KHAC"] as const satisfies readonly TicketType[];
export const TICKET_PRIORITIES = ["THAP", "TRUNG", "CAO", "KHAN"] as const satisfies readonly TicketPriority[];
export const TICKET_STATUSES = ["MOI", "DANG_XU_LY", "CHO_KHACH", "DA_GIAI_QUYET", "DONG"] as const satisfies readonly TicketStatus[];
export const OPEN_TICKET: TicketStatus[] = ["MOI", "DANG_XU_LY", "CHO_KHACH"];

export const TICKET_TYPE_LABEL: Record<TicketType, string> = { GIAO_CHAM: "Giao chậm", LOI_HANG: "Lỗi hàng", DOI_TRA: "Đổi trả", BAO_HANH: "Bảo hành", KHAC: "Khác" };
export const PRIORITY_LABEL: Record<TicketPriority, string> = { THAP: "Thấp", TRUNG: "Trung bình", CAO: "Cao", KHAN: "Khẩn" };
export const PRIORITY_TONE: Record<TicketPriority, Tone> = { THAP: "neutral", TRUNG: "info", CAO: "warning", KHAN: "danger" };
export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = { MOI: "Mới", DANG_XU_LY: "Đang xử lý", CHO_KHACH: "Chờ khách", DA_GIAI_QUYET: "Đã giải quyết", DONG: "Đã đóng" };
export const TICKET_STATUS_TONE: Record<TicketStatus, Tone> = { MOI: "info", DANG_XU_LY: "brand", CHO_KHACH: "warning", DA_GIAI_QUYET: "success", DONG: "neutral" };
export const KNOWLEDGE_STATUS_LABEL: Record<string, string> = { DRAFT: "Nháp", PUBLISHED: "Đã xuất bản", ARCHIVED: "Lưu trữ" };
