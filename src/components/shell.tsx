"use client";
// AppShell: sidebar cố định 248px (thu gọn 64px), topbar 56px dính, nội dung tối đa 1440px (ui-design-system mục 4).
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cx } from "./ui";
import { ToastProvider } from "./overlay";
import type { NavGroup } from "./nav";

const ICONS: Record<string, string> = {
  home: "M3 9.5 10 4l7 5.5V16a1 1 0 0 1-1 1h-4v-5H8v5H4a1 1 0 0 1-1-1V9.5Z",
  users: "M7 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm6.5-1a2.5 2.5 0 1 0 0-5M2 17c0-2.8 2.2-5 5-5s5 2.2 5 5m2-4.5c1.8.4 3 2 3 4.5",
  target: "M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm0-4a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  inbox: "M3 11h4l1 2h4l1-2h4M4 4h12l1 7v5H3v-5l1-7Z",
  check: "M4 10.5 8 14l8-8",
  bag: "M5 7h10l-1 10H6L5 7Zm2.5 0V5.5a2.5 2.5 0 0 1 5 0V7",
  alert: "M10 3 2 17h16L10 3Zm0 5v4m0 2.5v.5",
  truck: "M2 5h10v9H2zM12 8h3.5L18 11v3h-6M5 16.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm9 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z",
  box: "M3 6.5 10 3l7 3.5v7L10 17l-7-3.5v-7Zm0 0L10 10m0 7v-7m7-3.5L10 10",
  life: "M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm0-4a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM5 5l2.9 2.9M15 5l-2.9 2.9M5 15l2.9-2.9M15 15l-2.9-2.9",
  book: "M4 4h5a2 2 0 0 1 2 2v11a2 2 0 0 0-2-2H4V4Zm12 0h-5a2 2 0 0 0-2 2v11a2 2 0 0 1 2-2h5V4Z",
  pie: "M10 3v7h7a7 7 0 1 1-7-7Zm2.5-.3A7 7 0 0 1 17.3 7.5H12.5V2.7Z",
  route: "M5 16a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm10-8a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM7 14h6a3 3 0 0 0 0-6H7a3 3 0 0 1 0-6",
  flag: "M4 17V3m0 1h10l-2 3.5L14 11H4",
  chart: "M3 17h14M6 14V9m4 5V5m4 9v-3",
  spark: "M10 2.5 11.8 8l5.7 2-5.7 2L10 17.5 8.2 12l-5.7-2 5.7-2L10 2.5Z",
  plug: "M7 3v4m6-4v4M5 7h10v3a5 5 0 0 1-10 0V7Zm5 8v3",
  user: "M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-6 8c0-3.3 2.7-6 6-6s6 2.7 6 6",
  shield: "M10 2.5 16 5v5c0 3.5-2.5 6.3-6 7.5-3.5-1.2-6-4-6-7.5V5l6-2.5Z",
  grid: "M3 3h6v6H3zM11 3h6v6h-6zM3 11h6v6H3zM11 11h6v6h-6z",
  clock: "M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm0-11v4l2.5 2.5",
};
export function Icon({ name, className }: { name: string; className?: string }) {
  return (
    <svg aria-hidden className={cx("size-[18px] shrink-0", className)} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d={ICONS[name] ?? ICONS.grid} />
    </svg>
  );
}

type Props = {
  nav: NavGroup[];
  user: { name: string; email: string; roleLabel: string };
  workspace: { id: string; name: string };
  workspaces: { id: string; name: string }[];
  switchWorkspace: (fd: FormData) => Promise<void>;
  logout: () => Promise<void>;
  children: ReactNode;
};

export function AppShell({ nav, user, workspace, workspaces, switchWorkspace, logout, children }: Props) {
  const path = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => {
    try { setCollapsed(localStorage.getItem("crm.sidebar") === "1"); } catch {}
  }, []);
  useEffect(() => setMobileOpen(false), [path]);
  const toggle = () => setCollapsed((c) => {
    try { localStorage.setItem("crm.sidebar", c ? "0" : "1"); } catch {}
    return !c;
  });
  const isActive = (href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(href + "/"));

  const sidebar = (
    <nav aria-label="Menu chính" className="flex h-full flex-col">
      <div className={cx("flex h-14 items-center gap-2.5 border-b border-border px-4", collapsed && "lg:justify-center lg:px-0")}>
        <div aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-brand text-sm font-bold text-white">L</div>
        <span className={cx("font-semibold text-fg", collapsed && "lg:hidden")}>CRM LevelUp</span>
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-3">
        {nav.map((g, gi) => (
          <div key={gi} className="mb-3">
            {g.label && <p className={cx("mb-1 px-3 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle", collapsed && "lg:sr-only")}>{g.label}</p>}
            <ul>
              {g.items.map((it) => {
                const active = isActive(it.href);
                const base = cx("relative flex h-9 items-center gap-2.5 rounded-[var(--radius-sm)] px-3 text-sm", collapsed && "lg:justify-center lg:px-0");
                if (it.phase) {
                  return (
                    <li key={it.href}>
                      <span className={cx(base, "cursor-not-allowed text-fg-subtle")} title={`Sẽ có ở Phase ${it.phase}`} aria-disabled>
                        <Icon name={it.icon} />
                        <span className={cx("flex-1 truncate", collapsed && "lg:sr-only")}>{it.label}</span>
                        <span className={cx("text-[10px] font-medium", collapsed && "lg:hidden")}>P{it.phase}</span>
                      </span>
                    </li>
                  );
                }
                return (
                  <li key={it.href}>
                    <Link href={it.href} aria-current={active ? "page" : undefined} title={collapsed ? it.label : undefined}
                      className={cx(base, active ? "bg-brand-soft font-medium text-brand-active" : "text-fg-muted hover:bg-bg-muted hover:text-fg")}>
                      {active && <span aria-hidden className="absolute inset-y-1.5 left-0 w-[3px] rounded-r bg-brand" />}
                      <Icon name={it.icon} />
                      <span className={cx("truncate", collapsed && "lg:sr-only")}>{it.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
      <button type="button" onClick={toggle} className="hidden h-10 items-center justify-center gap-2 border-t border-border text-xs text-fg-muted hover:bg-bg-muted lg:flex" aria-label={collapsed ? "Mở rộng menu" : "Thu gọn menu"}>
        <span aria-hidden>{collapsed ? "»" : "«"}</span>
        <span className={cx(collapsed && "sr-only")}>Thu gọn</span>
      </button>
    </nav>
  );

  return (
    <ToastProvider>
      <div className="min-h-dvh bg-bg-subtle">
        <aside className={cx("fixed inset-y-0 left-0 hidden border-r border-border bg-bg lg:block", collapsed ? "w-16" : "w-[248px]")}>{sidebar}</aside>
        {mobileOpen && (
          <div className="fixed inset-0 z-[var(--z-dropdown)] lg:hidden">
            <button type="button" aria-label="Đóng menu" className="absolute inset-0 bg-fg/30" onClick={() => setMobileOpen(false)} />
            <aside className="absolute inset-y-0 left-0 w-[248px] border-r border-border bg-bg">{sidebar}</aside>
          </div>
        )}
        <div className={cx(collapsed ? "lg:pl-16" : "lg:pl-[248px]")}>
          <header className="sticky top-0 z-[var(--z-sticky)] flex h-14 items-center gap-3 border-b border-border bg-bg/95 px-4 backdrop-blur lg:px-6">
            <button type="button" className="rounded-[var(--radius-sm)] p-1.5 text-fg-muted hover:bg-bg-muted lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Mở menu">
              <svg aria-hidden width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M3 5h14M3 10h14M3 15h14" /></svg>
            </button>
            <WorkspaceSwitcher current={workspace} options={workspaces} action={switchWorkspace} />
            <div className="ml-auto flex items-center gap-2">
              <UserMenu user={user} logout={logout} />
            </div>
          </header>
          <main className="mx-auto w-full max-w-[1440px] px-4 py-6 lg:px-6">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}

function WorkspaceSwitcher({ current, options, action }: { current: { id: string; name: string }; options: { id: string; name: string }[]; action: (fd: FormData) => Promise<void> }) {
  if (options.length < 2) {
    return <span className="rounded-[var(--radius-sm)] bg-bg-muted px-2.5 py-1 text-sm font-medium text-fg">{current.name}</span>;
  }
  return (
    <form action={action}>
      <label className="flex items-center gap-2 text-sm">
        <span className="sr-only">Chọn team</span>
        <select name="workspaceId" defaultValue={current.id} onChange={(e) => e.currentTarget.form?.requestSubmit()}
          className="h-8 rounded-[var(--radius-sm)] border border-border bg-bg px-2.5 font-medium text-fg hover:border-border-strong">
          {options.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </label>
    </form>
  );
}

function UserMenu({ user, logout }: { user: Props["user"]; logout: () => Promise<void> }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && (ref.current.open = false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);
  const initials = user.name.split(" ").slice(-1)[0]?.[0] ?? "?";
  return (
    <details ref={ref} className="relative">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-[var(--radius-sm)] px-1.5 py-1 hover:bg-bg-muted [&::-webkit-details-marker]:hidden">
        <span aria-hidden className="flex size-7 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand-active">{initials}</span>
        <span className="hidden text-left sm:block">
          <span className="block text-[13px] font-medium leading-tight text-fg">{user.name}</span>
          <span className="block text-[11px] leading-tight text-fg-muted">{user.roleLabel}</span>
        </span>
      </summary>
      <div className="absolute right-0 top-full z-[var(--z-dropdown)] mt-1 w-56 rounded-[var(--radius-md)] border border-border bg-bg p-1 shadow-[var(--shadow-md)]">
        <p className="truncate px-3 py-2 text-xs text-fg-muted">{user.email}</p>
        <form action={logout}>
          <button type="submit" className="w-full rounded-[var(--radius-sm)] px-3 py-2 text-left text-sm text-fg hover:bg-bg-muted">Đăng xuất</button>
        </form>
      </div>
    </details>
  );
}
