import Link from "next/link";
import { pageUser } from "@/lib/current-user";
import { can } from "@/lib/permissions";
import { listReviews } from "@/modules/orders/links";
import { dateTime, money } from "@/lib/format";
import { Badge, Card, EmptyState, PageHeader, SectionTitle } from "@/components/ui";
import { ReviewButtons } from "./buttons";

type OrderLite = Awaited<ReturnType<typeof listReviews>>["reviews"][number]["a"];

export default async function VerifyPage() {
  const user = await pageUser("order.link");
  const { reviews, merges } = await listReviews(user);
  const showMoney = can(user.roles, "finance.view");
  return (
    <>
      <PageHeader
        title="Cần xác minh"
        crumbs={[{ label: "Bán hàng" }, { label: "Cần xác minh" }]}
        description="Hai đơn từ hai nguồn giống nhau (cùng SĐT, cùng giá trị, đặt cách nhau ít phút) nhưng không có mã tham chiếu. Hệ thống không tự gộp — bạn quyết."
      />
      {reviews.length === 0 ? (
        <Card><EmptyState icon="✓" title="Không có đơn nào cần xác minh" description="Đơn có mã tham chiếu chéo được liên kết tự động; chỉ đơn nghi trùng mới hiện ở đây." /></Card>
      ) : (
        <div className="space-y-4">
          {reviews.map((r) => {
            const reasons = r.reasons as { amountDiffUsd?: string; minutesApart?: number };
            return (
              <Card key={r.id}>
                <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3 text-sm">
                  <Badge tone="warning">Nghi trùng</Badge>
                  <span className="text-fg-muted">Cùng SĐT · chênh {reasons.amountDiffUsd ?? "0"} USD · đặt cách {reasons.minutesApart ?? "?"} phút</span>
                  <span className="tabular ml-auto text-xs text-fg-subtle">phát hiện {dateTime(r.createdAt)}</span>
                </div>
                <div className="grid grid-cols-1 divide-y divide-border md:grid-cols-2 md:divide-x md:divide-y-0">
                  <Side o={r.a} showMoney={showMoney} />
                  <Side o={r.b} showMoney={showMoney} />
                </div>
                <div className="flex flex-wrap justify-end gap-2 border-t border-border bg-bg-subtle px-4 py-3">
                  <ReviewButtons id={r.id} />
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Card className="mt-6">
        <SectionTitle>Lần gộp gần đây</SectionTitle>
        {merges.length === 0 ? (
          <p className="px-4 py-6 text-sm text-fg-muted">Chưa gộp đơn nào.</p>
        ) : (
          <ul className="divide-y divide-border">
            {merges.map((m) => {
              const snap = m.snapshot as { orderNumber?: string };
              return (
                <li key={m.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
                  <span>Đơn <span className="font-medium">{snap.orderNumber ?? m.mergedId}</span> gộp vào <Link href={`/don-hang/${m.survivorId}`} className="font-medium text-brand-active hover:underline">đơn giữ lại</Link></span>
                  <span className="tabular text-xs text-fg-subtle">{dateTime(m.mergedAt)}</span>
                  <span className="ml-auto">{m.unmergedAt ? <Badge>Đã tách lại {dateTime(m.unmergedAt)}</Badge> : <ReviewButtons id={m.id} unmerge />}</span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}

function Side({ o, showMoney }: { o: OrderLite; showMoney: boolean }) {
  return (
    <div className="px-4 py-3 text-sm">
      <div className="mb-2 flex items-center gap-2">
        <Link href={`/don-hang/${o.id}`} className="font-semibold text-fg hover:text-brand-active">{o.orderNumber}</Link>
        {o.links.map((l) => <Badge key={l.id} tone="info">{l.platform}</Badge>)}
      </div>
      <dl className="grid grid-cols-[110px_1fr] gap-y-1">
        <dt className="text-fg-muted">Shop</dt><dd>{o.store.name}</dd>
        <dt className="text-fg-muted">Đặt lúc</dt><dd className="tabular">{dateTime(o.bookedAt)}</dd>
        <dt className="text-fg-muted">Khách</dt><dd>{o.customerName ?? "—"} · <span className="tabular">{o.customerPhone ?? "—"}</span></dd>
        <dt className="text-fg-muted">Giá trị</dt><dd className="tabular">{showMoney ? money(o.netAmount.toString(), o.currency) : "—"}</dd>
        <dt className="text-fg-muted">Hàng</dt><dd>{o.items.map((i) => `${i.qty}× ${i.sourceSku}`).join(", ")}</dd>
      </dl>
    </div>
  );
}
