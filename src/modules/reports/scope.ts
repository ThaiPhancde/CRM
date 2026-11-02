// Phạm vi báo cáo bán hàng: Sales chỉ thấy của mình (docs/permissions.md "◐ cá nhân"); vai khác có report.sales thấy cả team.
import { can } from "@/lib/permissions";
import type { SessionUser } from "@/lib/session";

const TEAM_ROLES = ["MANAGER", "SALES_LEAD", "MARKETING", "FINANCE_VIEW"] as const;
export const reportScope = (u: SessionUser): "team" | "self" | null =>
  !can(u.roles, "report.sales") ? null : u.roles.some((r) => (TEAM_ROLES as readonly string[]).includes(r)) ? "team" : "self";
