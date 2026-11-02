import { notFound } from "next/navigation";
import { Badge, Card, PageHeader, SectionTitle } from "@/components/ui";
import { pageUser } from "@/lib/current-user";
import { bindTenant } from "@/lib/db";
import { dateTime, money, num } from "@/lib/format";
import { DEFAULT_LOW_STOCK, getProduct } from "@/modules/products/service";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await pageUser("product.view");
  bindTenant(user);
  const { id } = await params;

  let product: Awaited<ReturnType<typeof getProduct>>;
  try {
    product = await getProduct(user, id);
  } catch (e) {
    if (e && typeof e === "object" && "status" in e && (e as { status?: unknown }).status === 404) {
      notFound();
    }
    throw e;
  }

  const descText = [product.nameEn, product.nameAr, product.brand?.name, product.category]
    .filter(Boolean)
    .join(" · ");

  const mappedSources = product.variants.flatMap((v) =>
    v.sources.map((s) => ({
      sku: v.sku,
      connection: s.connection,
      sourceSku: s.sourceSku,
    })),
  );

  return (
    <>
      <PageHeader
        title={product.name}
        crumbs={[
          { label: "Bán hàng" },
          { href: "/san-pham", label: "Sản phẩm" },
          { label: product.code },
        ]}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <span>{descText}</span>
            {!product.active && <Badge tone="warning">Ngừng bán</Badge>}
          </span>
        }
      />

      <Card className="mb-6">
        <SectionTitle>Biến thể</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">Danh sách biến thể của sản phẩm</caption>
            <thead className="bg-bg-subtle">
              <tr className="text-left text-xs font-medium text-fg-muted">
                <th scope="col" className="h-10 border-b border-border px-4 whitespace-nowrap">
                  SKU
                </th>
                {product.markets.map((m) => (
                  <th
                    key={m}
                    scope="col"
                    className="h-10 border-b border-border px-4 text-right whitespace-nowrap"
                  >
                    {m}
                  </th>
                ))}
                <th scope="col" className="h-10 border-b border-border px-4 text-right whitespace-nowrap">
                  Bán 90 ngày
                </th>
                {product.showMoney && (
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
              {product.variants.map((v) => {
                const attrText = Object.values(v.attributes).filter(Boolean).join(" / ");
                return (
                  <tr key={v.id} className="h-11 border-b border-border last:border-0 hover:bg-bg-subtle">
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-xs font-medium text-fg">{v.sku}</span>
                        {attrText && <span className="text-xs text-fg-muted">{attrText}</span>}
                      </div>
                      {!v.known && (
                        <p className="text-xs text-fg-subtle">Mua hàng chưa có SKU này</p>
                      )}
                    </td>
                    {product.markets.map((m) => {
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
                    <td className="tabular px-4 py-2.5 text-right whitespace-nowrap">
                      <span className="font-medium text-fg">{num(v.qty90)}</span>
                      <span className="ml-1.5 text-xs text-fg-muted">
                        đã giao {num(v.delivered90)}
                      </span>
                    </td>
                    {product.showMoney && (
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
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <SectionTitle>Mã nguồn đã ánh xạ</SectionTitle>
        {mappedSources.length === 0 ? (
          <p className="px-4 py-6 text-sm text-fg-muted">
            Chưa có mã nguồn nào ánh xạ vào sản phẩm này.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">Danh sách mã nguồn đã ánh xạ của sản phẩm</caption>
              <thead className="bg-bg-subtle">
                <tr className="text-left text-xs font-medium text-fg-muted">
                  <th scope="col" className="h-10 border-b border-border px-4 whitespace-nowrap">
                    Biến thể (SKU)
                  </th>
                  <th scope="col" className="h-10 border-b border-border px-4 whitespace-nowrap">
                    Kết nối
                  </th>
                  <th scope="col" className="h-10 border-b border-border px-4 whitespace-nowrap">
                    Mã nguồn
                  </th>
                </tr>
              </thead>
              <tbody>
                {mappedSources.map((s) => (
                  <tr
                    key={`${s.sku}-${s.connection}-${s.sourceSku}`}
                    className="h-11 border-b border-border last:border-0 hover:bg-bg-subtle"
                  >
                    <td className="px-4 py-2.5 font-mono text-xs font-medium whitespace-nowrap text-fg">
                      {s.sku}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-fg">{s.connection}</td>
                    <td className="px-4 py-2.5 font-mono text-xs whitespace-nowrap text-fg">
                      {s.sourceSku}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="mt-4 text-xs text-fg-muted">
        {`Dữ liệu Mua hàng lúc ${product.asOf ? dateTime(product.asOf) : "chưa có"} · ngưỡng tồn thấp mặc định ${DEFAULT_LOW_STOCK} đơn vị mỗi thị trường (đổi ở Cấu hình).`}
      </p>
    </>
  );
}
