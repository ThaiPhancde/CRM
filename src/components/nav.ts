// Menu theo bản thiết kế mục 4. Mục chưa làm (phase sau) hiện mờ, không bấm được — người dùng thấy phạm vi
// demo mà không vào trang trống. Khi làm xong phase, đổi `phase` thành undefined và thêm `perm`.
import type { Permission } from "@/lib/permissions";

export type NavItem = { href: string; label: string; icon: string; perm?: Permission; phase?: number };
export type NavGroup = { label: string; items: NavItem[] };

export const NAV: NavGroup[] = [
  { label: "", items: [{ href: "/", label: "Tổng quan", icon: "home" }] },
  {
    label: "Khách hàng",
    items: [
      { href: "/khach-hang", label: "Khách hàng", icon: "users", phase: 3 },
      { href: "/nhu-cau", label: "Nhu cầu mua", icon: "target", phase: 4 },
      { href: "/hang-doi", label: "Hàng đợi của tôi", icon: "inbox", phase: 4 },
      { href: "/nhiem-vu", label: "Nhiệm vụ", icon: "check", phase: 4 },
    ],
  },
  {
    label: "Bán hàng",
    items: [
      { href: "/don-hang", label: "Đơn hàng", icon: "bag", perm: "order.view" },
      { href: "/xac-minh", label: "Cần xác minh", icon: "alert", perm: "order.link" },
      { href: "/van-don", label: "Vận đơn", icon: "truck", phase: 10 },
      { href: "/san-pham", label: "Sản phẩm", icon: "box", perm: "product.view" },
    ],
  },
  {
    label: "Chăm sóc",
    items: [
      { href: "/cham-soc", label: "Ticket", icon: "life", phase: 5 },
      { href: "/tri-thuc", label: "Tri thức", icon: "book", phase: 5 },
    ],
  },
  {
    label: "Marketing",
    items: [
      { href: "/phan-khuc", label: "Phân khúc", icon: "pie", phase: 7 },
      { href: "/hanh-trinh", label: "Hành trình", icon: "route", phase: 7 },
      { href: "/chien-dich", label: "Chiến dịch", icon: "flag", phase: 7 },
    ],
  },
  {
    label: "Phân tích",
    items: [
      { href: "/bao-cao", label: "Báo cáo", icon: "chart", phase: 9 },
      { href: "/ai", label: "Trợ lý AI", icon: "spark", phase: 8 },
    ],
  },
  {
    label: "Hệ thống",
    items: [
      { href: "/ket-noi", label: "Kết nối dữ liệu", icon: "plug", perm: "integration.view" },
      { href: "/quan-tri/nguoi-dung", label: "Người dùng", icon: "user", perm: "admin.users" },
      { href: "/quan-tri/vai-tro", label: "Vai trò & quyền", icon: "shield", perm: "admin.roles" },
      { href: "/quan-tri/danh-muc", label: "Danh mục", icon: "grid", perm: "admin.settings" },
      { href: "/quan-tri/nhat-ky", label: "Nhật ký", icon: "clock", perm: "admin.audit" },
    ],
  },
];
