"use client";
import Link from "next/link";
import { useActionState, useEffect } from "react";
import { ConfirmButton } from "@/components/confirm";
import { useToast } from "@/components/overlay";
import { Badge, Button, Card, EmptyState } from "@/components/ui";
import type { ActionResult } from "@/components/form";
import { date, dateTime, num, base } from "@/lib/format";
import type { listCustomerReviews } from "@/modules/customers/service";
import { mergeCustomerAction, rejectCustomerReviewAction } from "@/app/(app)/khach-hang/actions";

export type CustomerReviewItem = Awaited<ReturnType<typeof listCustomerReviews>>[number];
type CustomerSideData = CustomerReviewItem["a"];

function formatReasons(reasons: Record<string, unknown>): string {
  const parts: string[] = [];
  if (reasons.sameEmailUnverified) {
    const email = typeof reasons.sameEmailUnverified === "string" ? reasons.sameEmailUnverified : "";
    parts.push(email ? `Cùng email chưa xác minh: ${email}` : "Cùng email chưa xác minh");
  }
  if (reasons.sameStrongEvidence) {
    parts.push("Cùng SĐT/mã khách nhưng đang là hai hồ sơ");
  }
  return parts.length > 0 ? parts.join(" · ") : "Hồ sơ có thông tin nghi trùng cần kiểm tra";
}

function Act({
  action,
  id,
  label,
  ariaLabel,
  variant,
}: {
  action: (s: ActionResult | null, fd: FormData) => Promise<ActionResult>;
  id: string;
  label: string;
  ariaLabel: string;
  variant: "primary" | "secondary" | "ghost";
}) {
  const [state, run, pending] = useActionState(action, null);
  const toast = useToast();
  useEffect(() => {
    if (state) {
      toast(state.message || (state.ok ? "Đã cập nhật xác minh hồ sơ." : "Không thực hiện được."), state.ok ? "success" : "danger");
    }
  }, [state, toast]);
  return (
    <form action={run}>
      <input type="hidden" name="id" value={id} />
      <Button type="submit" size="sm" variant={variant} aria-label={ariaLabel} disabled={pending}>
        {pending ? "Đang xử lý…" : label}
      </Button>
    </form>
  );
}

export function CustomerReviewButtons({ id, names }: { id: string; names?: string }) {
  const context = names ?? id;
  return (
    <>
      <Act
        action={rejectCustomerReviewAction}
        id={id}
        label="Hai khách khác nhau"
        ariaLabel={`Hai khách khác nhau: ${context}`}
        variant="secondary"
      />
      <ConfirmButton
        action={mergeCustomerAction}
        fields={{ id }}
        label="Cùng một khách — gộp"
        ariaLabel={`Gộp hồ sơ khách ${context}`}
        variant="primary"
        title="Gộp hai hồ sơ khách hàng?"
        description="Đơn hàng và danh tính sẽ chuyển về một hồ sơ; bạn có thể tách lại sau nếu cần."
        confirmLabel="Gộp hai hồ sơ"
        okMessage="Đã gộp hai hồ sơ khách hàng."
      />
    </>
  );
}

function CustomerSide({ c }: { c: CustomerSideData }) {
  return (
    <div className="px-4 py-3 text-sm">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Link href={`/khach-hang/${c.id}`} className="font-semibold text-fg hover:text-brand-active">
          {c.name}
        </Link>
        {c.platforms.map((p) => (
          <Badge key={p} tone="info">
            {p}
          </Badge>
        ))}
      </div>
      <dl className="grid grid-cols-[130px_1fr] gap-y-1">
        <dt className="text-fg-muted">Số điện thoại</dt>
        <dd className="tabular text-fg">{c.phone ?? "—"}</dd>
        <dt className="text-fg-muted">Email</dt>
        <dd className="break-all text-fg">{c.email ?? "—"}</dd>
        <dt className="text-fg-muted">Thị trường</dt>
        <dd className="text-fg">{c.market ?? "—"}</dd>
        <dt className="text-fg-muted">Số đơn</dt>
        <dd className="tabular text-fg">{num(c.orderCount)} đơn</dd>
        <dt className="text-fg-muted">Mua gần nhất</dt>
        <dd className="tabular text-fg">{date(c.lastOrderAt)}</dd>
        <dt className="text-fg-muted">Giá trị 12 tháng</dt>
        <dd className="tabular text-fg">{c.valueBase12m != null ? base(c.valueBase12m) : "—"}</dd>
        <dt className="text-fg-muted">Nền tảng</dt>
        <dd className="text-fg">{c.platforms.length > 0 ? c.platforms.join(", ") : "—"}</dd>
      </dl>
    </div>
  );
}

export function CustomerReviewList({ reviews }: { reviews: CustomerReviewItem[] }) {
  if (reviews.length === 0) {
    return (
      <Card>
        <EmptyState
          icon="✓"
          title="Không có hồ sơ khách nào cần xác minh"
          description="Hồ sơ trùng mã khách nguồn hoặc số điện thoại được hợp nhất tự động; chỉ các trường hợp nghi trùng mới hiện ở đây."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {reviews.map((r) => (
        <Card key={r.id}>
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3 text-sm">
            <Badge tone="warning">Nghi trùng</Badge>
            <span className="text-fg-muted">{formatReasons(r.reasons)}</span>
            <span className="tabular ml-auto text-xs text-fg-subtle">phát hiện {dateTime(r.createdAt)}</span>
          </div>
          <div className="grid grid-cols-1 divide-y divide-border md:grid-cols-2 md:divide-x md:divide-y-0">
            <CustomerSide c={r.a} />
            <CustomerSide c={r.b} />
          </div>
          <div className="flex flex-wrap justify-end gap-2 border-t border-border bg-bg-subtle px-4 py-3">
            <CustomerReviewButtons id={r.id} names={`${r.a.name} và ${r.b.name}`} />
          </div>
        </Card>
      ))}
    </div>
  );
}
