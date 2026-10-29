// Trang Hồ sơ khách hàng 360 (Customer 360) — hiển thị thông tin hợp nhất từ mọi nền tảng bán hàng.
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge, ButtonLink, Card, cx, EmptyState, PageHeader, SectionTitle, StatCard, type Tone } from "@/components/ui";
import { pageUser } from "@/lib/current-user";
import { HttpError } from "@/lib/errors";
import { date, dateTime, money, num, base } from "@/lib/format";
import { FULFILLMENT_STATUS, ORDER_STATUS, PAYMENT_STATUS, pickBadge } from "@/lib/status-badge";
import { getCustomer360, type TimelineItem } from "@/modules/customers/service";
import { PreferenceForm } from "./preference-form";
import { UnmergeButton } from "./unmerge-button";

type ProfileTab = "tong-quan" | "don" | "tuong-tac" | "dia-chi" | "danh-tinh" | "gop";

const TIMELINE_DOT: Record<TimelineItem["tone"], string> = {
  brand: "border-brand bg-brand-soft",
  success: "border-success bg-success-soft",
  danger: "border-danger bg-danger-soft",
  info: "border-info bg-info-soft",
  neutral: "border-border-strong bg-bg",
};

const CHANNEL_LABEL: Record<string, string> = {
  EMAIL: "Email",
  SMS: "Tin nhắn SMS",
  PHONE: "Điện thoại",
  WHATSAPP: "WhatsApp",
  MESSENGER: "Messenger",
};

const PURPOSE_LABEL: Record<string, string> = {
  MARKETING: "Tiếp thị",
  SERVICE: "Chăm sóc",
};

const ADDRESS_KIND_LABEL: Record<string, string> = {
  SHIPPING: "Giao hàng",
  BILLING: "Thanh toán",
};

export default async function CustomerProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await pageUser("customer.view");
  const [{ id }, sp] = await Promise.all([params, searchParams]);

  let res: Awaited<ReturnType<typeof getCustomer360>>;
  try {
    res = await getCustomer360(user, id);
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound();
    throw e;
  }

  if ("redirectTo" in res) {
    redirect("/khach-hang/" + res.redirectTo);
  }

  const {
    customer: c,
    summary,
    orders,
    identities,
    addresses,
    preferences,
    merges,
    timeline,
    showMoney,
    showPii,
    canMerge,
    canEdit,
    pendingReviews,
  } = res;

  const tabs: { key: ProfileTab; label: string; count?: number }[] = [
    { key: "tong-quan", label: "Tổng quan" },
    { key: "don", label: "Đơn hàng", count: orders.length },
    { key: "tuong-tac", label: "Tương tác" },
    { key: "dia-chi", label: "Địa chỉ", count: addresses.length },
    { key: "danh-tinh", label: "Danh tính", count: identities.length },
    { key: "gop", label: "Lịch sử gộp", count: merges.length },
  ];

  // ponytail: dòng thời gian cắt 40 sự kiện gần nhất; khách rất nhiều đơn xem đủ ở tab Đơn hàng (phân trang khi cần).
  const shownTimeline = timeline.slice(0, 40);

  const rawTab = Array.isArray(sp.tab) ? sp.tab[0] : sp.tab;
  const tab: ProfileTab = tabs.some((t) => t.key === rawTab) ? (rawTab as ProfileTab) : "tong-quan";

  const marketDesc = c.market
    ? `${c.market.code} · ${c.market.name} (${c.market.currency} · ${c.market.paymentMode === "COD" ? "COD" : "Trả trước"})`
    : "Chưa rõ thị trường";

  return (
    <>
      <PageHeader
        title={c.name}
        crumbs={[
          { href: "/khach-hang", label: "Khách hàng" },
          { label: c.name },
        ]}
        description={`${marketDesc} · khách từ ${date(summary.firstOrderAt ?? c.createdAt)}`}
        actions={
          pendingReviews > 0 && canMerge ? (
            <ButtonLink href="/xac-minh?tab=khach" variant="primary">
              Có {pendingReviews} hồ sơ nghi trùng
            </ButtonLink>
          ) : undefined
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        <StatCard
          label="Giá trị 12 tháng"
          metric="REV-03"
          value={summary.valueBase12m != null ? base(summary.valueBase12m) : "—"}
          hint={summary.valueBase12m != null ? "Giao thành công trừ hoàn (VND)" : "Cần quyền xem tiền"}
        />
        <StatCard
          label="Số đơn"
          value={num(summary.orderCount)}
          hint={`${num(summary.deliveredOrders)} đơn đã giao · không tính đơn hủy`}
        />
        <StatCard
          label="Mua gần nhất"
          value={date(summary.lastOrderAt)}
          hint={summary.firstOrderAt ? `Mua lần đầu: ${date(summary.firstOrderAt)}` : "Chưa có đơn hàng"}
        />
        <StatCard
          label="Giao thất bại/hoàn"
          value={num(summary.failedOrders)}
          hint={summary.failedOrders > 0 ? "Đơn giao thất bại hoặc hoàn hàng" : "Không có đơn lỗi giao hàng"}
        />
        <StatCard
          label="Điểm khách hàng"
          value={summary.score ?? <span className="text-xl font-semibold">Chưa đủ dữ liệu</span>}
          hint="Có ở Phase 6"
        />
      </div>

      <div
        role="tablist"
        aria-label="Mục hồ sơ khách hàng"
        className="mb-4 flex gap-1 overflow-x-auto shadow-[inset_0_-1px_0_var(--border)]"
      >
        {tabs.map((t) => (
          <Link
            key={t.key}
            role="tab"
            aria-selected={t.key === tab}
            href={`?tab=${t.key}`}
            scroll={false}
            className={cx(
              "whitespace-nowrap border-b-2 px-3 py-2 text-sm",
              t.key === tab ? "border-brand font-medium text-brand-active" : "border-transparent text-fg-muted hover:text-fg",
            )}
          >
            {t.label}
            {t.count !== undefined && <span className="tabular ml-1.5 text-xs text-fg-subtle">({num(t.count)})</span>}
          </Link>
        ))}
      </div>

      {tab === "tong-quan" && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="space-y-4 xl:col-span-2">
            <Card>
              <SectionTitle>Dòng thời gian hợp nhất</SectionTitle>
              {timeline.length === 0 ? (
                <EmptyState
                  title="Chưa có hoạt động nào"
                  description="Sự kiện đặt đơn, giao vận, hoàn tiền, gộp hồ sơ và quyền liên hệ sẽ hiển thị tại đây theo thứ tự thời gian."
                />
              ) : (
                <ol className="px-4 py-3">
                  {shownTimeline.map((item, k) => (
                    <li key={`${item.kind}-${item.at}-${k}`} className="relative flex gap-3 pb-4 last:pb-0">
                      {k < shownTimeline.length - 1 && (
                        <span aria-hidden className="absolute left-[5px] top-3 h-full w-px bg-border" />
                      )}
                      <span
                        aria-hidden
                        className={cx("mt-1.5 size-[11px] shrink-0 rounded-full border-2", TIMELINE_DOT[item.tone])}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-fg">
                          {item.href ? (
                            <Link href={item.href} className="hover:text-brand-active hover:underline">
                              {item.title}
                            </Link>
                          ) : (
                            item.title
                          )}
                          {item.detail && <span className="font-normal text-fg-muted"> · {item.detail}</span>}
                        </p>
                        <p className="tabular text-xs text-fg-muted">{dateTime(item.at)}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
              {timeline.length > shownTimeline.length && (
                <p className="border-t border-border px-4 py-2 text-xs text-fg-muted">
                  Hiển thị {num(shownTimeline.length)}/{num(timeline.length)} sự kiện gần nhất ·{" "}
                  <Link href="?tab=don" scroll={false} className="text-brand-active hover:underline">Xem toàn bộ đơn hàng</Link>
                </p>
              )}
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <SectionTitle>Thông tin liên hệ</SectionTitle>
              <dl className="space-y-2.5 px-4 py-3 text-sm">
                <InfoRow label="Số điện thoại" value={<span className="tabular">{c.phone ?? "—"}</span>} />
                <InfoRow label="Email" value={c.email ?? "—"} />
                <InfoRow
                  label="Thị trường"
                  value={c.market ? `${c.market.code} · ${c.market.name}` : "—"}
                />
                <InfoRow label="Ngôn ngữ / vùng" value={c.locale ?? "—"} />
                <InfoRow
                  label="Thẻ phân loại"
                  value={
                    c.tags.length > 0 ? (
                      <span className="flex flex-wrap justify-end gap-1">
                        {c.tags.map((tag) => (
                          <Badge key={tag} tone="brand">
                            {tag}
                          </Badge>
                        ))}
                      </span>
                    ) : (
                      "—"
                    )
                  }
                />
              </dl>
              {!showPii && (
                <p className="border-t border-border px-4 py-2 text-xs text-fg-subtle">
                  Số điện thoại và email đang được che một phần theo phân quyền hiện tại.
                </p>
              )}
            </Card>

            <Card>
              <SectionTitle>Quyền liên hệ</SectionTitle>
              {preferences.length === 0 ? (
                <p className="px-4 py-4 text-sm text-fg-muted">Chưa ghi nhận lựa chọn liên hệ nào cho khách hàng này.</p>
              ) : (
                <ul className="divide-y divide-border text-sm">
                  {preferences.map((p) => (
                    <li key={p.id} className="px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium text-fg">
                          {CHANNEL_LABEL[p.channel] ?? p.channel} · {PURPOSE_LABEL[p.purpose] ?? p.purpose}
                        </span>
                        {p.optIn ? <Badge tone="success">Đồng ý</Badge> : <Badge tone="danger">Từ chối</Badge>}
                      </div>
                      <p className="mt-1 text-xs text-fg-muted">
                        Nguồn: <span className="text-fg">{p.source}</span> ·{" "}
                        <span className="tabular">{dateTime(p.changedAt)}</span>
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              {canEdit && <PreferenceForm customerId={c.id} />}
            </Card>

            <p className="px-1 text-xs text-fg-subtle">
              <Link href="/khach-hang" className="hover:text-fg-muted">
                ‹ Về danh sách khách hàng
              </Link>
            </p>
          </div>
        </div>
      )}

      {tab === "don" && (
        <Card>
          <SectionTitle>Đơn hàng ({num(orders.length)})</SectionTitle>
          {orders.length === 0 ? (
            <EmptyState
              title="Khách hàng chưa có đơn nào"
              description="Đơn hàng từ các nền tảng bán sẽ tự động gắn vào hồ sơ này khi trùng số điện thoại hoặc mã khách nguồn."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <caption className="sr-only">Danh sách đơn hàng của khách hàng</caption>
                <thead className="sticky top-0 z-[var(--z-sticky)] bg-bg-subtle">
                  <tr className="text-left text-xs font-medium text-fg-muted">
                    {["Mã đơn", "Ngày đặt", "Shop", "Đơn", "Thanh toán", "Giao hàng", "Giá trị"].map((h, i) => (
                      <th
                        key={h}
                        scope="col"
                        className={cx("h-10 border-b border-border px-4 whitespace-nowrap", i === 6 && "text-right")}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id} className="h-11 border-b border-border last:border-0 hover:bg-bg-subtle">
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <Link href={`/don-hang/${o.id}`} className="font-medium text-fg hover:text-brand-active">
                          {o.orderNumber}
                        </Link>
                      </td>
                      <td className="tabular px-4 py-2.5 whitespace-nowrap text-fg-muted">{dateTime(o.bookedAt)}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className="mr-2 text-fg">{o.store}</span>
                        <Badge tone="info">{o.platform}</Badge>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <StatusBadge map={ORDER_STATUS} value={o.status} />
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <StatusBadge map={PAYMENT_STATUS} value={o.paymentStatus} />
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <StatusBadge map={FULFILLMENT_STATUS} value={o.fulfillmentStatus} />
                      </td>
                      <td className="tabular px-4 py-2.5 text-right whitespace-nowrap">
                        {showMoney && o.net != null ? (
                          <>
                            <p className="text-fg">{money(o.net, o.currency)}</p>
                            <p className="text-xs text-fg-subtle">{base(o.netBase)}</p>
                          </>
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
        </Card>
      )}

      {tab === "tuong-tac" && (
        <Card>
          <EmptyState
            title="Chưa có tương tác — ghi cuộc gọi, tin nhắn có ở Phase 4"
            description="Lịch sử cuộc gọi, tin nhắn chăm sóc và ghi chú nội bộ với khách hàng sẽ hiển thị tại đây."
          />
        </Card>
      )}

      {tab === "dia-chi" && (
        <Card>
          <SectionTitle>Địa chỉ ({num(addresses.length)})</SectionTitle>
          {addresses.length === 0 ? (
            <EmptyState
              title="Chưa có địa chỉ nào"
              description="Địa chỉ giao hàng và thanh toán được ghi nhận tự động từ đơn hàng của khách."
            />
          ) : (
            <ul className="divide-y divide-border text-sm">
              {addresses.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={a.kind === "SHIPPING" ? "info" : "neutral"}>
                      {ADDRESS_KIND_LABEL[a.kind] ?? a.kind}
                    </Badge>
                    <span className="font-medium text-fg">
                      Quốc gia: {a.countryCode ?? a.text ?? "—"}
                    </span>
                    {a.text && a.countryCode && a.text !== a.countryCode && (
                      <span className="text-fg-muted">({a.text})</span>
                    )}
                  </div>
                  {a.isDefault && <Badge tone="brand">Mặc định</Badge>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {tab === "danh-tinh" && (
        <Card>
          <SectionTitle>Danh tính nguồn ({num(identities.length)})</SectionTitle>
          <p className="border-b border-border bg-bg-subtle px-4 py-2.5 text-xs text-fg-muted">
            Hồ sơ chỉ tự động gộp khi trùng mã khách ở cùng nguồn hoặc trùng số điện thoại chuẩn hóa (E.164); trùng email chưa xác minh sẽ đưa vào hàng đợi xác minh.
          </p>
          {identities.length === 0 ? (
            <EmptyState
              title="Chưa có danh tính nguồn"
              description="Danh tính được tạo tự động khi đồng bộ đơn hàng hoặc khách hàng từ các nền tảng bán."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <caption className="sr-only">Danh sách danh tính nguồn của khách hàng</caption>
                <thead className="sticky top-0 z-[var(--z-sticky)] bg-bg-subtle">
                  <tr className="text-left text-xs font-medium text-fg-muted">
                    {["Nền tảng", "Shop", "Mã khách nguồn", "Số điện thoại", "Email", "Ghi nhận lần đầu"].map((h) => (
                      <th key={h} scope="col" className="h-10 border-b border-border px-4 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {identities.map((i) => (
                    <tr key={i.id} className="h-11 border-b border-border last:border-0 hover:bg-bg-subtle">
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <Badge tone="info">{i.platform}</Badge>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-fg">{i.store ?? "—"}</td>
                      <td className="px-4 py-2.5 font-mono text-xs whitespace-nowrap text-fg">
                        {i.sourceCustomerId ?? "—"}
                      </td>
                      <td className="tabular px-4 py-2.5 whitespace-nowrap text-fg">{i.phone ?? "—"}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className="text-fg">{i.email ?? "—"}</span>
                        {i.emailVerified && (
                          <span className="ml-2">
                            <Badge tone="success">Đã xác minh</Badge>
                          </span>
                        )}
                      </td>
                      <td className="tabular px-4 py-2.5 whitespace-nowrap text-fg-muted">{dateTime(i.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === "gop" && (
        <Card>
          <SectionTitle>Lịch sử gộp hồ sơ ({num(merges.length)})</SectionTitle>
          {merges.length === 0 ? (
            <EmptyState
              title="Chưa có lịch sử gộp hồ sơ"
              description="Các lần gộp hoặc tách lại hồ sơ khách hàng sẽ được lưu vết đầy đủ tại đây."
            />
          ) : (
            <ul className="divide-y divide-border text-sm">
              {merges.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {m.role === "survivor" ? (
                        <Badge tone="brand">Hồ sơ giữ lại</Badge>
                      ) : (
                        <Badge tone="neutral">Hồ sơ được gộp</Badge>
                      )}
                      <span className="text-fg">
                        {m.role === "survivor" ? "Đã nhận gộp từ hồ sơ " : "Đã gộp vào hồ sơ "}
                        <Link
                          href={`/khach-hang/${m.otherId}`}
                          className="font-mono text-xs font-medium text-brand-active hover:underline"
                        >
                          {m.otherId}
                        </Link>
                      </span>
                    </div>
                    <p className="tabular text-xs text-fg-muted">Thời điểm gộp: {dateTime(m.mergedAt)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {m.unmergedAt ? (
                      <Badge tone="neutral">Đã tách lại lúc {dateTime(m.unmergedAt)}</Badge>
                    ) : canMerge && m.role === "survivor" ? (
                      <UnmergeButton mergeId={m.id} />
                    ) : (
                      <Badge tone="success">Đang gộp</Badge>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-fg-muted">{label}</dt>
      <dd className="text-right text-fg">{value}</dd>
    </div>
  );
}

function StatusBadge({
  map,
  value,
}: {
  map: Record<string, { label: string; tone: Tone }>;
  value: string;
}) {
  const b = pickBadge(map, value);
  return <Badge tone={b.tone}>{b.label}</Badge>;
}
