// Thành phần trình bày thuần (server-safe) theo docs/ui-design-system.md mục 5.
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
export { cx };

type Variant = "primary" | "secondary" | "ghost" | "danger";
const VARIANT: Record<Variant, string> = {
  primary: "bg-brand text-white hover:bg-brand-hover active:bg-brand-active shadow-sm",
  secondary: "bg-bg text-fg border border-border hover:bg-bg-subtle",
  ghost: "text-fg-muted hover:bg-bg-muted hover:text-fg",
  danger: "bg-bg text-danger border border-border hover:bg-danger-soft",
};
const btn = (variant: Variant, size: "sm" | "md") =>
  cx(
    "inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-sm)] font-medium transition-colors whitespace-nowrap",
    "disabled:opacity-50 disabled:pointer-events-none",
    size === "sm" ? "h-8 px-3 text-[13px]" : "h-9 px-4 text-sm",
    VARIANT[variant],
  );

export function Button({ variant = "secondary", size = "md", className, ...p }: ComponentProps<"button"> & { variant?: Variant; size?: "sm" | "md" }) {
  return <button type="button" className={cx(btn(variant, size), className)} {...p} />;
}
export function ButtonLink({ variant = "secondary", size = "md", className, ...p }: ComponentProps<typeof Link> & { variant?: Variant; size?: "sm" | "md" }) {
  return <Link className={cx(btn(variant, size), className)} {...p} />;
}

export type Tone = "neutral" | "brand" | "success" | "warning" | "danger" | "info";
const TONE: Record<Tone, string> = {
  neutral: "bg-bg-muted text-fg-muted",
  brand: "bg-brand-soft text-brand-active",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
};
export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={cx("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", TONE[tone])}>{children}</span>;
}

export function PageHeader({ title, description, actions, crumbs }: { title: string; description?: ReactNode; actions?: ReactNode; crumbs?: { href?: string; label: string }[] }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {crumbs && (
          <nav aria-label="Đường dẫn" className="mb-1 flex items-center gap-1.5 text-xs text-fg-subtle">
            {crumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && <span aria-hidden>/</span>}
                {c.href ? <Link href={c.href} className="hover:text-fg-muted">{c.label}</Link> : <span>{c.label}</span>}
              </span>
            ))}
          </nav>
        )}
        <h1 className="text-2xl font-semibold tracking-tight text-fg">{title}</h1>
        {description && <p className="mt-1 text-sm text-fg-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Card({ className, children, ...p }: ComponentProps<"section">) {
  return (
    <section className={cx("rounded-[var(--radius-md)] border border-border bg-bg shadow-[var(--shadow-sm)]", className)} {...p}>
      {children}
    </section>
  );
}

export function StatCard({ label, value, hint, metric, href }: { label: string; value: ReactNode; hint?: ReactNode; metric?: string; href?: string }) {
  const body = (
    <Card className={cx("relative h-full p-4", href && "transition-colors hover:border-brand-ring")}>
      {metric && <span className="absolute right-3 top-3 text-[11px] font-medium text-fg-subtle" title="Mã chỉ số">{metric}</span>}
      <p className="text-xs font-medium text-fg-muted">{label}</p>
      <p className="tabular mt-1 text-[32px] font-semibold leading-tight text-fg">{value}</p>
      {hint && <p className="mt-1 text-xs text-fg-muted">{hint}</p>}
    </Card>
  );
  return href ? <Link href={href} className="block h-full">{body}</Link> : body;
}

export function EmptyState({ title, description, action, icon = "○" }: { title: string; description?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div aria-hidden className="mb-3 flex size-12 items-center justify-center rounded-full bg-brand-soft text-xl text-brand">{icon}</div>
      <p className="font-medium text-fg">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-fg-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cx("animate-pulse rounded-[var(--radius-sm)] bg-bg-muted", className)} />;
}

/** Khung tải cho trang danh sách: cùng hình dạng PageHeader + bảng (mục 1.3). */
export function PageSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Đang tải">
      <Skeleton className="mb-2 h-7 w-56" />
      <Skeleton className="mb-6 h-4 w-80" />
      <Card className="p-4">
        <Skeleton className="mb-4 h-8 w-64" />
        {Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="mb-2 h-9 w-full" />)}
      </Card>
    </div>
  );
}

export function SectionTitle({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
      <h2 className="text-base font-semibold text-fg">{children}</h2>
      {actions}
    </div>
  );
}
