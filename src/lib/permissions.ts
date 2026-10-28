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
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof MATRIX;
export const PERMISSIONS = Object.keys(MATRIX) as Permission[];

export function can(roles: readonly Role[], perm: Permission): boolean {
  const allowed: readonly Role[] = MATRIX[perm];
  return roles.some((r) => allowed.includes(r));
}
