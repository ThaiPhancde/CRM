// Hằng số + nhãn thuần (không import DB) — dùng được trong component chạy trên trình duyệt.
import type { LeadStage } from "@prisma/client";
import type { Tone } from "@/components/ui";

export const LEAD_STAGES = ["MOI", "DANG_TU_VAN", "CHO_QUYET_DINH", "DA_MUA", "TU_CHOI", "MAT_LIEN_LAC"] as const satisfies readonly LeadStage[];
export const LANGUAGES = ["vi", "en", "ar", "de"] as const;
export const STAGE_LABEL: Record<LeadStage, string> = {
  MOI: "Mới", DANG_TU_VAN: "Đang tư vấn", CHO_QUYET_DINH: "Chờ quyết định", DA_MUA: "Đã mua", TU_CHOI: "Từ chối", MAT_LIEN_LAC: "Mất liên lạc",
};
export const STAGE_TONE: Record<LeadStage, Tone> = {
  MOI: "info", DANG_TU_VAN: "brand", CHO_QUYET_DINH: "warning", DA_MUA: "success", TU_CHOI: "neutral", MAT_LIEN_LAC: "danger",
};
export const SOURCE_LABEL: Record<string, string> = { inbox: "Hộp thư", website: "Website", ads: "Quảng cáo", referral: "Giới thiệu", manual: "Nhập tay" };
export const TASK_TYPE_LABEL: Record<string, string> = { CALL_BACK: "Gọi lại", FOLLOW_UP: "Theo dõi", MEETING: "Hẹn gặp", OTHER: "Khác" };
