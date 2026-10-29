// Nhãn tiếng Việt + màu cho trạng thái nghiệp vụ (ui-design-system mục 5, Badge). Một chỗ duy nhất để mọi trang hiển thị giống nhau.
import type { Tone } from "@/components/ui";

type Map = Record<string, { label: string; tone: Tone }>;

export const ORDER_STATUS: Map = {
  BOOKED: { label: "Mới đặt", tone: "info" },
  CONFIRMED: { label: "Đã xác nhận", tone: "brand" },
  CANCELLED: { label: "Đã hủy", tone: "neutral" },
};
export const PAYMENT_STATUS: Map = {
  PENDING: { label: "Chưa thanh toán", tone: "warning" },
  PAID: { label: "Đã thanh toán", tone: "success" },
  PARTIAL: { label: "Thanh toán một phần", tone: "warning" },
  REFUNDED: { label: "Đã hoàn tiền", tone: "neutral" },
  COD_PENDING: { label: "COD chờ thu", tone: "warning" },
  COD_COLLECTED: { label: "COD đã thu", tone: "success" },
};
export const FULFILLMENT_STATUS: Map = {
  UNFULFILLED: { label: "Chưa giao", tone: "neutral" },
  IN_TRANSIT: { label: "Đang giao", tone: "info" },
  PARTIAL: { label: "Giao một phần", tone: "warning" },
  DELIVERED: { label: "Đã giao", tone: "success" },
  FAILED: { label: "Giao thất bại", tone: "danger" },
  RETURNED: { label: "Hoàn hàng", tone: "danger" },
};
export const RETURN_STATUS: Map = {
  NONE: { label: "Không hoàn", tone: "neutral" },
  PARTIAL: { label: "Hoàn một phần", tone: "warning" },
  FULL: { label: "Hoàn toàn bộ", tone: "danger" },
};
export const EVENT_OUTCOME: Map = {
  APPLIED: { label: "Đã áp dụng", tone: "success" },
  LINKED: { label: "Đã liên kết", tone: "brand" },
  STALE: { label: "Bản cũ, bỏ qua", tone: "neutral" },
  NOT_OWNER: { label: "Không phải nguồn chủ", tone: "neutral" },
  DUPLICATE: { label: "Trùng, bỏ qua", tone: "neutral" },
  ERROR: { label: "Lỗi", tone: "danger" },
};
export const DELIVERY_EVENT: Record<string, string> = {
  PICKED: "Đã lấy hàng", IN_TRANSIT: "Đang vận chuyển", OUT_FOR_DELIVERY: "Đang giao", DELIVERED: "Đã giao",
  FAILED: "Giao thất bại", RETURNED: "Đã hoàn về", COD_COLLECTED: "Đã thu COD",
};
export const FAILURE_REASON: Record<string, string> = {
  customer_refused: "Khách từ chối nhận", unreachable: "Không liên lạc được", wrong_address: "Sai địa chỉ", carrier_delay: "Hãng vận chuyển chậm",
};
export const SYNC_STATUS: Map = {
  RUNNING: { label: "Đang chạy", tone: "info" },
  OK: { label: "Thành công", tone: "success" },
  FAILED: { label: "Thất bại", tone: "danger" },
};
export const CONNECTION_STATUS: Map = {
  ACTIVE: { label: "Đang chạy", tone: "success" },
  PAUSED: { label: "Tạm dừng", tone: "neutral" },
  ERROR: { label: "Lỗi", tone: "danger" },
};

export const pickBadge = (m: Map, k: string) => m[k] ?? { label: k, tone: "neutral" as Tone };
