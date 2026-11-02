import Link from "next/link";
import type { ReactNode } from "react";
import { Badge, ButtonLink, Card, cx, EmptyState, PageHeader, SectionTitle, StatCard } from "@/components/ui";
import { pageUser } from "@/lib/current-user";
import { bindTenant } from "@/lib/db";
import { dateTime, money, num } from "@/lib/format";
import {
  DEFAULT_LOW_STOCK,
  listProducts,
  productFilter,
  type ProductFilter,
  unmatchedSkus,
} from "@/modules/products/service";
import { MapSkuForm, SyncCostsButton } from "./product-actions";

function flatten(sp: Record<string, string | string[] | undefined>): Record<string, string | undefined> {
  return Object.fromEntries(
    Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]),
  );
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await pageUser("product.view");
  bindTenant(user);
  const f = productFilter.parse(flatten(await searchParams));
  const [data, unmatched] = await Promise.all([
    listProducts(user, f),
    unmatchedSkus(user),
  ]);

  const lowTotal = Object.values(data.summary.lowByMarket).reduce((s, n) => s + n, 0);
  const lowHintParts = Object.entries(data.summary.lowByMarket)
    .filter(([, n]) => n > 0)
    .map(([m, n]) => `${m} ${num(n)}`);
  const lowHint = lowHintParts.length > 0 ? lowHintParts.join(" · ") : "Không có biến thể dưới ngưỡng";

  const hasFilters = Boolean(f.q || f.brand || f.market || f.low);
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));

  const qs = (patch: Partial<Record<keyof ProductFilter, string | number | undefined>>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...f, ...patch })) {
      if (v !== undefined && v !== "" && !(k === "page" && v === 1)) {
        p.set(k, String(v));
      }
    }
    const s = p.toString();
    return s ? `?${s}` : "/san-pham";
  };

  return (
    <>
      <PageHeader
        title="Sản phẩm"
        crumbs={[{ label: "Bán hàng" }, { label: "Sản phẩm" }]}
        description="Danh mục chung của team. Giá vốn và tồn khả dụng đọc từ Mua hàng (PurchasingLink, chỉ đọc); mã SKU của từng nền tảng ánh xạ về biến thể ở đây."
        actions={data.canSync ? <SyncCostsButton pending={data.summary.costDiffers} /> : undefined}
      />

      <div
        className={cx(
          "mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2",
          data.showMoney ? "lg:grid-cols-5" : "lg:grid-cols-4",
        )}
      >
        <StatCard label="Sản phẩm" value={num(data.summary.products)} />
        <StatCard label="Biến thể (SKU)" value={num(data.summary.variants)} />
        <StatCard
          label="Tồn thấp"
          value={num(lowTotal)}
          hint={lowHint}
          href="?low=1"
        />
        <StatCard
          label="Mã nguồn chưa khớp"
          value={num(data.summary.unmatchedSkus)}
          href="#chua-khop"
        />
        {data.showMoney && (
          <StatCard
            label="Giá vốn lệch Mua hàng"
            value={num(data.summary.costDiffers)}
          />
        )}
      </div>

      <Card>
        <form method="get" className="flex flex-wrap items-end gap-2 border-b border-border px-4 py-3">
          <Filter label="Tìm">
            <input
              name="q"
              defaultValue={f.q}
              placeholder="Tên, mã sản phẩm hoặc SKU"
              className="h-8 w-60 rounded-[var(--radius-sm)] border border-border bg-bg px-2.5 text-sm text-fg placeholder:text-fg-subtle"
            />
          </Filter>
          <Filter label="Brand">
            <select
              name="brand"
              defaultValue={f.brand ?? ""}
              className="h-8 max-w-48 rounded-[var(--radius-sm)] border border-border bg-bg px-2 text-sm text-fg"
            >
              <option value="">Tất cả</option>
              {data.brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.code}
                </option>
              ))}
            </select>
          </Filter>
          <Filter label="Thị trường">
            <select
              name="market"
              defaultValue={f.market ?? ""}
              className="h-8 max-w-48 rounded-[var(--radius-sm)] border border-border bg-bg px-2 text-sm text-fg"
            >
              <option value="">Tất cả</option>
              {data.markets.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </Filter>
          <label className="flex h-8 cursor-pointer items-center gap-1.5 px-1 text-xs text-fg">
            <input
              type="checkbox"
              name="low"
              value="1"
              defaultChecked={f.low === "1"}
              className="size-4 accent-[var(--brand)]"
            />
            Chỉ tồn thấp
          </label>
          <button
            type="submit"
            className="h-8 rounded-[var(--radius-sm)] bg-brand px-3 text-sm font-medium text-white hover:bg-brand-hover"
          >
            Lọc
          </button>
          <Link href="/san-pham" className="h-8 px-2 text-sm leading-8 text-fg-muted hover:text-fg">
            Đặt lại
          </Link>
        </form>

        {data.rows.length === 0 ? (
          hasFilters ? (
            <EmptyState
              title="Không có sản phẩm khớp bộ lọc"
              description="Thử thay đổi từ khóa hoặc đặt lại bộ lọc để xem toàn bộ danh mục."
              action={<ButtonLink href="/san-pham">Đặt lại</ButtonLink>}
            />
          ) : (
            <EmptyState
              title="Chưa có sản phẩm"
              description="Chạy npm run db:seed-demo để nạp danh mục mẫu."
            />
          )
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">Danh sách sản phẩm và biến thể</caption>
              <thead className="sticky top-0 z-[var(--z-sticky)] bg-bg-subtle">
                <tr className="text-left text-xs font-medium text-fg-muted">
                  <th scope="col" className="h-10 border-b border-border px-4 whitespace-nowrap">
                    Sản phẩm
                  </th>
                  <th scope="col" className="h-10 border-b border-border px-4 whitespace-nowrap">
                    SKU
                  </th>
                  {data.markets.map((m) => (
                    <th
                      key={m}
                      scope="col"
                      className="h-10 border-b border-border px-4 text-right whitespace-nowrap"
                    >
                      {m}
                    </th>
                  ))}
                  <th scope="col" className="h-10 border-b border-border px-4 text-right whitespace-nowrap">
                    Dòng đơn
                  </th>
                  <th scope="col" className="h-10 border-b border-border px-4 text-right whitespace-nowrap">
                    Ánh xạ nguồn
                  </th>
                  {data.showMoney && (
                    <>
                      <th scope="col" className="h-10 border-b border-border px-4 text-right whitespace-nowrap">
                        Giá vốn CRM
                      </th>
                      <th scope="col" className="h-10 border-b border-border px-4 text-right whitespace-nowrap">
                        Giá vốn Mua hàng
                      </th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((p) =>
                  p.variants.map((v, idx) => {
                    const attrText = Object.values(v.attributes).filter(Boolean).join(" / ");
                    return (
                      <tr key={v.id} className="h-11 border-b border-border last:border-0 hover:bg-bg-subtle">
                        {idx === 0 && (
                          <td
                            rowSpan={p.variants.length}
                            className="border-r border-border px-4 py-2.5 align-top whitespace-nowrap"
                          >
                            <Link
                              href={`/san-pham/${p.id}`}
                              className="font-medium text-fg hover:text-brand-active"
                            >
                              {p.name}
                            </Link>
                            <p className="mt-0.5 text-xs text-fg-muted">
                              {[p.brand?.code, p.category].filter(Boolean).join(" · ")}
                            </p>
                          </td>
                        )}
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-mono text-xs font-medium text-fg">{v.sku}</span>
                            {attrText && <span className="text-xs text-fg-muted">{attrText}</span>}
                          </div>
                          {!v.known && (
                            <p className="text-xs text-fg-subtle">Mua hàng chưa có SKU này</p>
                          )}
                        </td>
                        {data.markets.map((m) => {
                          const st = v.stock[m];
                          const isLow = v.low.includes(m);
                          return (
                            <td key={m} className="tabular px-4 py-2.5 text-right whitespace-nowrap">
                              {st == null ? (
                                <span className="text-fg-subtle">—</span>
                              ) : (
                                <span className="inline-flex items-center justify-end gap-1.5">
                                  <span className="text-fg">{num(st)}</span>
                                  {isLow && <Badge tone="warning">Thấp</Badge>}
                                </span>
                              )}
                            </td>
                          );
                        })}
                        <td className="tabular px-4 py-2.5 text-right whitespace-nowrap text-fg">
                          {num(v.sold)}
                        </td>
                        <td className="tabular px-4 py-2.5 text-right whitespace-nowrap text-fg">
                          {num(v.mappings)}
                        </td>
                        {data.showMoney && (
                          <>
                            <td className="tabular px-4 py-2.5 text-right whitespace-nowrap text-fg">
                              {v.cost != null && v.costCurrency ? money(v.cost, v.costCurrency) : "—"}
                            </td>
                            <td className="tabular px-4 py-2.5 text-right whitespace-nowrap">
                              <span className="inline-flex items-center justify-end gap-1.5">
                                <span className="text-fg">
                                  {v.purchasingCost != null && v.purchasingCurrency
                                    ? money(v.purchasingCost, v.purchasingCurrency)
                                    : "—"}
                                </span>
                                {v.costDiffers && <Badge tone="info">Lệch</Badge>}
                              </span>
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  }),
                )}
              </tbody>
            </table>
          </div>
        )}

        {data.total > data.pageSize && (
          <nav
            aria-label="Phân trang"
            className="flex items-center justify-between border-t border-border px-4 py-2.5 text-xs text-fg-muted"
          >
            <span className="tabular">
              Trang {data.page}/{pages} · {num(data.total)} sản phẩm
            </span>
            <div className="flex gap-2">
              {data.page > 1 ? (
                <Link
                  className="rounded-[var(--radius-sm)] border border-border px-2.5 py-1 hover:bg-bg-muted"
                  href={qs({ page: data.page - 1 })}
                >
                  ‹ Trước
                </Link>
              ) : (
                <span className="px-2.5 py-1 opacity-40">‹ Trước</span>
              )}
              {data.page < pages ? (
                <Link
                  className="rounded-[var(--radius-sm)] border border-border px-2.5 py-1 hover:bg-bg-muted"
                  href={qs({ page: data.page + 1 })}
                >
                  Sau ›
                </Link>
              ) : (
                <span className="px-2.5 py-1 opacity-40">Sau ›</span>
              )}
            </div>
          </nav>
        )}
      </Card>

      <Card id="chua-khop" className="mt-6">
        <SectionTitle>Mã nguồn chưa khớp</SectionTitle>
        {unmatched.length === 0 ? (
          <p className="px-4 py-6 text-sm text-fg-muted">
            Mọi mã SKU trong đơn đều đã khớp danh mục.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">Danh sách mã nguồn chưa khớp</caption>
              <thead className="bg-bg-subtle">
                <tr className="text-left text-xs font-medium text-fg-muted">
                  <th scope="col" className="h-10 border-b border-border px-4 whitespace-nowrap">
                    Mã nguồn
                  </th>
                  <th scope="col" className="h-10 border-b border-border px-4 whitespace-nowrap">
                    Tên trên đơn
                  </th>
                  <th scope="col" className="h-10 border-b border-border px-4 text-right whitespace-nowrap">
                    Số dòng đơn
                  </th>
                  {data.canMap && (
                    <th scope="col" className="h-10 border-b border-border px-4 whitespace-nowrap">
                      Gắn vào biến thể
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {unmatched.map((r) => (
                  <tr key={r.sourceSku} className="h-11 border-b border-border last:border-0 hover:bg-bg-subtle">
                    <td className="px-4 py-2.5 font-mono text-xs whitespace-nowrap text-fg">
                      {r.sourceSku}
                    </td>
                    <td className="px-4 py-2.5 text-fg">{r.name ?? "—"}</td>
                    <td className="tabular px-4 py-2.5 text-right whitespace-nowrap text-fg">
                      {num(r.lines)}
                    </td>
                    {data.canMap && (
                      <td className="px-4 py-2 min-w-64">
                        <MapSkuForm sourceSku={r.sourceSku} variants={data.variantOptions} />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="mt-4 text-xs text-fg-muted">
        {`Dữ liệu Mua hàng lúc ${data.asOf ? dateTime(data.asOf) : "chưa có"} · ngưỡng tồn thấp mặc định ${DEFAULT_LOW_STOCK} đơn vị mỗi thị trường (đổi ở Cấu hình).`}
      </p>
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
