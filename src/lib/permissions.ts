// Ma trận quyền theo docs/permissions.md (D-21, D-32). Logic thuần, không phụ thuộc DB/React.
// Mỗi phase thêm quyền của mình vào đây; server luôn kiểm qua can()/requirePerm(), ẩn menu không thay được bước này.
// Quản trị công ty không phải vai trò trong workspace: ở workspace không có membership thì mang MANAGER (src/lib/session.ts).
import type { Role } from "@prisma/client";

export type { Role };
export const ROLES = ["MANAGER", "SALES_LEAD", "SALES", "MARKETING", "FULFILLMENT", "PURCHASING_VIEW", "FINANCE_VIEW"] as const satisfies readonly Role[];

export const ROLE_LABEL: Record<Role, string> = {
  MANAGER: "Quản lý",
  SALES_LEAD: "Trưởng nhóm sales",
  SALES: "Sales/CSKH",
  MARKETING: "Marketing",
  FULFILLMENT: "Vận đơn",
  PURCHASING_VIEW: "Mua hàng (xem)",
  FINANCE_VIEW: "Kế toán (xem tiền)",
};

const ALL: readonly Role[] = ROLES;

const MATRIX = {
  /** Xem/thêm/sửa người dùng và vai trò trong workspace. */
  "admin.users": ["MANAGER"],
  /** Xem ma trận quyền. */
  "admin.roles": ["MANAGER"],
  /** Danh mục brand, store, market, team, tỷ giá; cấu hình. */
  "admin.settings": ["MANAGER"],
  /** Nhật ký thao tác. */
  "admin.audit": ["MANAGER"],
  /** Xem danh mục (dùng cho bộ lọc ở mọi trang). */
  "catalog.view": ALL,
  /** Số tiền, tỷ giá, COD (che ở service khi thiếu). */
  "finance.view": ["MANAGER", "SALES_LEAD", "FINANCE_VIEW"],
  /** Thêm/tạm dừng kết nối, chạy đồng bộ, chạy lại sự kiện lỗi (Phase 2). Khóa API nhạy cảm → chỉ Quản lý. */
  "integration.manage": ["MANAGER"],
  /** Xem trạng thái kết nối, lượt đồng bộ, lỗi. */
  "integration.view": ["MANAGER", "SALES_LEAD", "MARKETING", "FULFILLMENT"],
  /** Xem đơn hàng. ponytail: Sales thấy mọi đơn của team; giới hạn theo khách được giao khi có phân công (Phase 4). */
  "order.view": ["MANAGER", "SALES_LEAD", "SALES", "MARKETING", "FULFILLMENT", "PURCHASING_VIEW", "FINANCE_VIEW"],
  /** Duyệt gộp/tách đơn nghi trùng giữa hai nguồn (/xac-minh). */
  "order.link": ["MANAGER", "FULFILLMENT"],
  /** Xem sản phẩm và ánh xạ mã nguồn. */
  "product.view": ALL,
  /** Xem hồ sơ khách (Customer 360). ponytail: Sales thấy mọi khách của team; giới hạn theo khách được giao ở Phase 4. */
  "customer.view": ["MANAGER", "SALES_LEAD", "SALES", "MARKETING", "FULFILLMENT", "FINANCE_VIEW"],
  /** SĐT/email đầy đủ; thiếu quyền thì che giữa ở service (UI, API, CSV, AI đều nhận bản đã che). */
  "customer.pii": ["MANAGER", "SALES_LEAD", "SALES", "FULFILLMENT"],
  /** Sửa tên/thẻ khách, ghi lựa chọn liên hệ. */
  "customer.edit": ["MANAGER", "SALES_LEAD", "SALES"],
  /** Gộp/tách hồ sơ khách (/xac-minh tab Khách, lịch sử gộp). */
  "customer.merge": ["MANAGER", "SALES_LEAD"],
  /** Xem nhu cầu mua. Phạm vi lọc ở service (src/modules/sales/scope.ts): Sales của mình + chưa giao của nhóm, Trưởng nhóm cả nhóm. */
  "lead.view": ["MANAGER", "SALES_LEAD", "SALES", "MARKETING"],
  /** Tạo/sửa lead, đổi giai đoạn, ghi tương tác. */
  "lead.edit": ["MANAGER", "SALES_LEAD", "SALES"],
  /** Chuyển phụ trách (Trưởng nhóm chỉ trong nhóm mình). */
  "lead.assign": ["MANAGER", "SALES_LEAD"],
  /** Tạo/hoàn thành nhiệm vụ. Người không có quyền giao chỉ tạo/sửa việc của chính mình. */
  "task.manage": ["MANAGER", "SALES_LEAD", "SALES", "MARKETING", "FULFILLMENT"],
  /** Xem/xử lý ticket. Phạm vi ở src/modules/service/scope.ts: Sales của mình + chưa giao của nhóm; Vận đơn ticket giao hàng/đổi trả. */
  "ticket.view": ["MANAGER", "SALES_LEAD", "SALES", "FULFILLMENT"],
  "ticket.edit": ["MANAGER", "SALES_LEAD", "SALES", "FULFILLMENT"],
  /** Giao/chuyển ticket (Trưởng nhóm trong nhóm mình). */
  "ticket.assign": ["MANAGER", "SALES_LEAD"],
  /** Đọc bài tri thức đã xuất bản. */
  "knowledge.view": ALL,
  /** Soạn bài (thêm phiên bản) / xuất bản. */
  "knowledge.edit": ["MANAGER", "SALES_LEAD", "MARKETING"],
  "knowledge.publish": ["MANAGER", "SALES_LEAD", "MARKETING"],
  /** Đổi trọng số điểm (tạo phiên bản mới), tính lại điểm ngay (Phase 6). */
  "score.config": ["MANAGER"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof MATRIX;
export const PERMISSIONS = Object.keys(MATRIX) as Permission[];

export function can(roles: readonly Role[], perm: Permission): boolean {
  const allowed: readonly Role[] = MATRIX[perm];
  return roles.some((r) => allowed.includes(r));
}
