import { pageUser } from "@/lib/current-user";
import { bindTenant, db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { num, usd } from "@/lib/format";
import { Badge, Card, EmptyState, PageHeader, StatCard } from "@/components/ui";

// Phase 2: danh mục sản phẩm chung + ánh xạ mã nguồn. Giá vốn/tồn qua tích hợp Mua hàng ở Phase 10.
export default async function ProductsPage() {
  const user = await pageUser("product.view");
  bindTenant(user);
  const [products, unmatched] = await Promise.all([
    db.product.findMany({
      orderBy: [{ brand: { name: "asc" } }, { code: "asc" }],
      include: { brand: true, variants: { include: { _count: { select: { items: true, mappings: true } } } } },
    }),
    db.orderItem.groupBy({ by: ["sourceSku"], where: { variantId: null }, _count: true, orderBy: { _count: { sourceSku: "desc" } }, take: 20 }),
  ]);
  const showCost = can(user.roles, "finance.view");
  const variants = products.reduce((s, p) => s + p.variants.length, 0);
  return (
    <>
      <PageHeader title="Sản phẩm" crumbs={[{ label: "Bán hàng" }, { label: "Sản phẩm" }]}
        description="Danh mục sản phẩm chung của team. Mã SKU từ từng nền tảng được ánh xạ về biến thể ở đây, nên báo cáo không bị tách theo nền tảng." />
      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Sản phẩm" value={num(products.length)} />
        <StatCard label="Biến thể (SKU)" value={num(variants)} />
        <StatCard label="Mã nguồn chưa khớp" value={num(unmatched.length)} hint={unmatched.length ? "SKU xuất hiện trong đơn nhưng chưa có trong danh mục" : "Mọi SKU đều đã khớp"} />
      </div>
      <Card>
        {products.length === 0 ? (
          <EmptyState title="Chưa có sản phẩm" description="Chạy npm run db:seed-demo để nạp danh mục mẫu." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Danh mục sản phẩm</caption>
              <thead className="sticky top-0 z-[var(--z-sticky)] bg-bg-subtle text-left text-xs text-fg-muted">
                <tr>{["Sản phẩm", "Brand", "Nhóm", "Biến thể", "Đã bán (dòng đơn)", "Ánh xạ nguồn", ...(showCost ? ["Giá vốn"] : [])].map((h, i) => <th key={h} scope="col" className={`h-10 px-4 font-medium ${i >= 4 ? "text-right" : ""}`}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="border-t border-border align-top">
                    <td className="px-4 py-2.5"><p className="font-medium text-fg">{p.name}</p><p className="text-xs text-fg-muted">{p.nameEn}{p.nameAr ? ` · ${p.nameAr}` : ""}</p><p className="font-mono text-[11px] text-fg-subtle">{p.code}</p></td>
                    <td className="px-4 py-2.5">{p.brand?.name ?? "—"}</td>
                    <td className="px-4 py-2.5 text-fg-muted">{p.category}</td>
                    <td className="px-4 py-2.5"><div className="flex flex-wrap gap-1">{p.variants.map((v) => <Badge key={v.id}>{Object.values(v.attributes as Record<string, string>).join(" / ") || v.sku}</Badge>)}</div></td>
                    <td className="tabular px-4 py-2.5 text-right">{num(p.variants.reduce((s, v) => s + v._count.items, 0))}</td>
                    <td className="tabular px-4 py-2.5 text-right">{num(p.variants.reduce((s, v) => s + v._count.mappings, 0))}</td>
                    {showCost && <td className="tabular px-4 py-2.5 text-right">{p.variants[0]?.costPrice ? usd(p.variants[0].costPrice.toString()) : "—"}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
