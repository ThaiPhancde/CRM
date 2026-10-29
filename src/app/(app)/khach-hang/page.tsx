import Link from "next/link";
import type { ReactNode } from "react";
import { pageUser } from "@/lib/current-user";
import { getCatalog } from "@/modules/admin/service";
import { listCustomers, parseCustomerFilter, type CustomerFilter } from "@/modules/customers/service";
import { date, num, usd } from "@/lib/format";
import { Badge, ButtonLink, Card, EmptyState, PageHeader, StatCard } from "@/components/ui";

export default async function CustomersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await pageUser("customer.view");
  const f = parseCustomerFilter(await searchParams);
  const [data, catalog] = await Promise.all([
    listCustomers(user, f),
    getCatalog(user),
  ]);

  const qs = (patch: Partial<Record<keyof CustomerFilter, string | number | undefined>>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...f, ...patch })) {
      if (v !== undefined && v !== "" && !(k === "page" && v === 1) && !(k === "sort" && v === "recent")) {
        p.set(k, String(v));
      }
    }
    const s = p.toString();
    return s ? `?${s}` : "?";
  };

  const hasFilterConstraint = Boolean(
    f.q || f.brand || f.market || (data.showMoney && f.minValue != null) || f.lastFrom || f.lastTo || f.repeat,
  );
  const filtered = hasFilterConstraint || f.sort !== "recent";

  const sortOptions: [string, string][] = [
    ["recent", "Mua gần nhất"],
    ...(data.showMoney ? ([["value", "Giá trị 12 tháng (REV-03)"]] as [string, string][]) : []),
    ["orders", "Số đơn hàng"],
    ["name", "Tên khách (A–Z)"],
  ];
  const currentSort = f.sort === "value" && !data.showMoney ? "recent" : f.sort;

  return (
    <>
      <PageHeader
        title="Khách hàng"
        crumbs={[{ label: "Khách hàng" }, { label: "Khách hàng" }]}
        description="Hồ sơ khách hàng được hợp nhất tự động từ mọi nền tảng bán hàng theo mã khách nguồn và số điện thoại chuẩn hóa."
      />

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Tổng khách hàng (theo bộ lọc)" value={num(data.total)} />
        <StatCard
          label="Khách mua lại"
          value={num(data.repeatCount)}
          hint={data.total > 0 ? `${num(data.repeatCount)} khách có từ 2 đơn trở lên` : "Khách có từ 2 đơn hàng trở lên"}
        />
        <StatCard
          label="Điểm khách hàng"
          value={<span className="text-xl font-medium text-fg-muted">Chưa đủ dữ liệu</span>}
          hint="Tính năng chấm điểm khách hàng mở từ Phase 6"
        />
      </div>

      <Card>
        <form method="get" className="flex flex-wrap items-end gap-2 border-b border-border px-4 py-3">
          <Filter label="Tìm kiếm">
            <input
              name="q"
              defaultValue={f.q}
              placeholder="Tên, SĐT, email, mã khách nguồn…"
              className="h-8 w-60 rounded-[var(--radius-sm)] border border-border bg-bg px-2.5 text-sm text-fg placeholder:text-fg-subtle"
            />
          </Filter>
          <Filter label="Thương hiệu">
            <Select name="brand" value={f.brand} options={catalog.brands.map((b) => [b.id, b.name])} />
          </Filter>
          <Filter label="Thị trường">
            <Select name="market" value={f.market} options={catalog.markets.map((m) => [m.id, `${m.code} · ${m.name}`])} />
          </Filter>
          {data.showMoney && (
            <Filter label="REV-03 tối thiểu (USD)">
              <input
                type="number"
                name="minValue"
                min={0}
                step="any"
                defaultValue={f.minValue ?? ""}
                placeholder="0"
                className="tabular h-8 w-36 rounded-[var(--radius-sm)] border border-border bg-bg px-2.5 text-sm text-fg placeholder:text-fg-subtle"
              />
            </Filter>
          )}
          <Filter label="Mua gần nhất từ">
            <input
              type="date"
              name="lastFrom"
              defaultValue={f.lastFrom}
              className="h-8 rounded-[var(--radius-sm)] border border-border bg-bg px-2 text-sm text-fg"
            />
          </Filter>
          <Filter label="Đến ngày">
            <input
              type="date"
              name="lastTo"
              defaultValue={f.lastTo}
              className="h-8 rounded-[var(--radius-sm)] border border-border bg-bg px-2 text-sm text-fg"
            />
          </Filter>
          <Filter label="Sắp xếp">
            <select
              name="sort"
              defaultValue={currentSort}
              className="h-8 max-w-48 rounded-[var(--radius-sm)] border border-border bg-bg px-2 text-sm text-fg"
            >
              {sortOptions.map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </Filter>
          <label className="flex h-8 cursor-pointer items-center gap-1.5 px-1 text-xs text-fg">
            <input
              type="checkbox"
              name="repeat"
              value="1"
              defaultChecked={f.repeat === "1"}
              className="size-4 accent-[var(--brand)]"
            />
            Chỉ khách mua lại
          </label>
          <button
            type="submit"
            className="h-8 rounded-[var(--radius-sm)] bg-brand px-3 text-sm font-medium text-white hover:bg-brand-hover"
          >
            Lọc
          </button>
          {filtered && (
            <Link href="/khach-hang" className="h-8 px-2 text-sm leading-8 text-fg-muted hover:text-fg">
              Xóa lọc
            </Link>
          )}
          {!data.showPii && (
            <p className="w-full pt-0.5 text-xs text-fg-subtle">
              Gợi ý: Tài khoản hiện tại không có quyền xem thông tin định danh (PII), ô tìm kiếm chỉ tra cứu theo tên hoặc mã khách nguồn (không tìm theo SĐT/email).
            </p>
          )}
        </form>

        {data.rows.length === 0 ? (
          hasFilterConstraint ? (
            <EmptyState
              title="Không có khách hàng khớp bộ lọc"
              description="Thử thay đổi từ khóa hoặc xóa bộ lọc để xem toàn bộ danh sách khách hàng."
              action={<ButtonLink href="/khach-hang">Xóa lọc</ButtonLink>}
            />
          ) : (
            <EmptyState
              title="Chưa có khách hàng nào"
              description="Hồ sơ khách hàng sẽ xuất hiện sau khi kết nối dữ liệu chạy đồng bộ đơn hàng."
              action={<ButtonLink href="/ket-noi" variant="primary">Mở Kết nối dữ liệu</ButtonLink>}
            />
          )
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">Danh sách khách hàng</caption>
              <thead className="sticky top-0 z-[var(--z-sticky)] bg-bg-subtle">
                <tr className="text-left text-xs font-medium text-fg-muted">
                  {[
                    "Khách",
                    "Email",
                    "Thị trường",
                    "Số đơn",
                    "Mua lần đầu",
                    "Mua gần nhất",
                    "Giá trị 12 tháng (REV-03)",
                    "Nguồn",
                    "Thẻ",
                  ].map((h, i) => (
                    <th
                      key={h}
                      scope="col"
                      className={`h-10 border-b border-border px-4 whitespace-nowrap ${i === 3 || i === 6 ? "text-right" : ""}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((c) => (
                  <tr key={c.id} className="h-11 border-b border-border last:border-0 hover:bg-bg-subtle">
                    <td className="px-4 py-2 whitespace-nowrap">
                      <Link href={`/khach-hang/${c.id}`} className="font-medium text-fg hover:text-brand-active">
                        {c.name}
                      </Link>
                      <p className="tabular text-xs text-fg-subtle">{c.phone ?? "—"}</p>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-fg-muted">{c.email ?? "—"}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-fg">{c.market ?? "—"}</td>
                    <td className="tabular px-4 py-2 text-right whitespace-nowrap" title="Đã giao / Tổng số đơn">
                      <span className="text-fg">{num(c.deliveredOrders)}</span>
                      <span className="text-fg-subtle">/{num(c.orderCount)}</span>
                    </td>
                    <td className="tabular px-4 py-2 whitespace-nowrap text-fg-muted">{date(c.firstOrderAt)}</td>
                    <td className="tabular px-4 py-2 whitespace-nowrap text-fg-muted">{date(c.lastOrderAt)}</td>
                    <td className="tabular px-4 py-2 text-right whitespace-nowrap">
                      {c.valueUsd12m != null ? (
                        <span className="font-medium text-fg">{usd(c.valueUsd12m)}</span>
                      ) : (
                        <span className="text-fg-subtle">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      {c.platforms.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {c.platforms.map((p) => (
                            <Badge key={p} tone="info">{p}</Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-fg-subtle">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      {c.tags.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {c.tags.map((t) => (
                            <Badge key={t} tone="neutral">{t}</Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-fg-subtle">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data.total > 0 && (
          <nav aria-label="Phân trang" className="flex items-center justify-between border-t border-border px-4 py-2.5 text-xs text-fg-muted">
            <span className="tabular">Trang {data.page}/{data.pages} · {num(data.total)} khách hàng</span>
            <div className="flex gap-2">
              {data.page > 1 ? (
                <Link className="rounded-[var(--radius-sm)] border border-border px-2.5 py-1 hover:bg-bg-muted" href={qs({ page: data.page - 1 })}>
                  ‹ Trước
                </Link>
              ) : (
                <span className="px-2.5 py-1 opacity-40">‹ Trước</span>
              )}
              {data.page < data.pages ? (
                <Link className="rounded-[var(--radius-sm)] border border-border px-2.5 py-1 hover:bg-bg-muted" href={qs({ page: data.page + 1 })}>
                  Sau ›
                </Link>
              ) : (
                <span className="px-2.5 py-1 opacity-40">Sau ›</span>
              )}
            </div>
          </nav>
        )}
      </Card>
    </>
  );
}

function Filter({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-fg-muted">
      {label}
      {children}
    </label>
  );
}

function Select({ name, value, options }: { name: string; value?: string; options: [string, string][] }) {
  return (
    <select name={name} defaultValue={value ?? ""} className="h-8 max-w-48 rounded-[var(--radius-sm)] border border-border bg-bg px-2 text-sm text-fg">
      <option value="">Tất cả</option>
      {options.map(([v, l]) => (
        <option key={v} value={v}>{l}</option>
      ))}
    </select>
  );
}
