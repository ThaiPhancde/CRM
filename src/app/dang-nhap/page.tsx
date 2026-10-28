import { redirect } from "next/navigation";
import { rootDb } from "@/lib/db";
import { currentUser } from "@/lib/current-user";
import { ROLE_LABEL } from "@/lib/permissions";
import { Badge } from "@/components/ui";
import { demoLogin } from "../auth-actions";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ loi?: string }> }) {
  if (await currentUser()) redirect("/");
  const { loi } = await searchParams;
  const demo = process.env.DEMO_LOGIN === "true";
  const users = demo
    ? await rootDb.user.findMany({
        where: { active: true },
        include: { memberships: { where: { active: true }, include: { workspace: true } } },
        orderBy: [{ isCompanyAdmin: "desc" }, { name: "asc" }],
      })
    : [];
  const google = !!process.env.GOOGLE_CLIENT_ID;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg-subtle px-4 py-10">
      <div className="w-full max-w-[460px]">
        <div className="mb-6 flex items-center gap-3">
          <div aria-hidden className="flex size-10 items-center justify-center rounded-[var(--radius-md)] bg-brand text-lg font-bold text-white">L</div>
          <div>
            <p className="text-lg font-semibold text-fg">CRM LevelUp</p>
            <p className="text-sm text-fg-muted">Đăng nhập để tiếp tục</p>
          </div>
        </div>
        <div className="rounded-[var(--radius-lg)] border border-border bg-bg p-5 shadow-[var(--shadow-sm)]">
          {loi && <p role="alert" className="mb-4 rounded-[var(--radius-sm)] bg-danger-soft px-3 py-2 text-sm text-danger">Tài khoản không đăng nhập được (đã khóa hoặc chưa thuộc team nào).</p>}
          {google && (
            <button type="button" disabled className="mb-4 h-10 w-full rounded-[var(--radius-sm)] border border-border text-sm font-medium text-fg-muted" title="Khung đăng nhập Google, chưa chạy thật (Phase 12)">
              Đăng nhập bằng Google (chưa bật)
            </button>
          )}
          {demo ? (
            <>
              <div className="mb-3 flex items-center justify-between">
                <h1 className="text-sm font-semibold text-fg">Đăng nhập thử</h1>
                <Badge tone="brand">Demo</Badge>
              </div>
              <p className="mb-4 text-xs text-fg-muted">Chọn một người mẫu theo vai trò. Quyền vẫn được kiểm ở máy chủ như thật.</p>
              <ul className="flex flex-col gap-2">
                {users.map((u) => (
                  <li key={u.id}>
                    <form action={demoLogin}>
                      <input type="hidden" name="userId" value={u.id} />
                      <button type="submit" className="flex w-full items-center justify-between gap-3 rounded-[var(--radius-md)] border border-border px-3 py-2.5 text-left transition-colors hover:border-brand-ring hover:bg-brand-soft">
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-fg">{u.name}</span>
                          <span className="block truncate text-xs text-fg-muted">
                            {u.isCompanyAdmin ? "Mọi team" : u.memberships.map((m) => m.workspace.name).join(" · ")}
                          </span>
                        </span>
                        <span className="shrink-0">
                          <Badge tone={u.isCompanyAdmin ? "brand" : "neutral"}>
                            {u.isCompanyAdmin ? "Quản trị công ty" : [...new Set(u.memberships.flatMap((m) => m.roles))].map((r) => ROLE_LABEL[r]).join(", ")}
                          </Badge>
                        </span>
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-sm text-fg-muted">Đăng nhập thử đang tắt. Liên hệ quản trị để được cấp quyền.</p>
          )}
        </div>
      </div>
    </main>
  );
}
