import { currentUserOrRedirect } from "@/lib/current-user";
import { can, ROLE_LABEL } from "@/lib/permissions";
import { AppShell } from "@/components/shell";
import { NAV } from "@/components/nav";
import { logout, switchWorkspace } from "../auth-actions";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUserOrRedirect();
  // Ẩn mục không có quyền (server vẫn kiểm lại ở từng trang).
  const nav = NAV.map((g) => ({ ...g, items: g.items.filter((it) => !it.perm || can(user.roles, it.perm)) })).filter((g) => g.items.length);
  const roleLabel = user.isCompanyAdmin && !user.roles.some((r) => r !== "MANAGER")
    ? "Quản trị công ty"
    : user.roles.map((r) => ROLE_LABEL[r]).join(", ");
  return (
    <AppShell
      nav={nav}
      user={{ name: user.name, email: user.email, roleLabel }}
      workspace={user.workspace}
      workspaces={user.workspaces}
      switchWorkspace={switchWorkspace}
      logout={logout}
    >
      {children}
    </AppShell>
  );
}
