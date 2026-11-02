import { pageUser } from "@/lib/current-user";
import { getConfig } from "@/modules/admin/config";
import { PRIORITY_LABEL, PRIORITY_TONE } from "@/modules/service/labels";
import { Badge, ButtonLink, Card, PageHeader, SectionTitle } from "@/components/ui";
import { CapForm, HoursForm, LowStockForm, RoutingForm, SlaForm } from "./forms";

const CHANNEL_LABEL: Record<string, string> = {
  EMAIL: "Email",
  SMS: "SMS",
  WHATSAPP: "WhatsApp",
  ZALO: "Zalo",
};

export default async function ConfigPage() {
  const user = await pageUser("admin.settings");
  const cfg = await getConfig(user);

  const brandCodeById = new Map(cfg.brands.map((b) => [b.id, b.code]));
  const marketNameByCode = new Map(cfg.markets.map((m) => [m.code, m.name]));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cấu hình vận hành"
        crumbs={[{ label: "Hệ thống" }, { label: "Cấu hình" }]}
        description="Ngưỡng SLA, phân công nhu cầu mua, giới hạn liên hệ, giờ làm việc theo thị trường và ngưỡng tồn thấp. Mỗi thay đổi ghi nhật ký."
      />

      <div className="flex flex-wrap items-center gap-2">
        <ButtonLink href="/quan-tri/danh-muc" size="sm">
          Tỷ giá &amp; thị trường (ngôn ngữ, múi giờ)
        </ButtonLink>
        <ButtonLink href="/quan-tri/diem" size="sm">
          Trọng số điểm
        </ButtonLink>
        <ButtonLink href="/ai?tab=chi-phi" size="sm">
          Ngân sách AI
        </ButtonLink>
        <ButtonLink href="/quan-tri/nhat-ky?entity=Setting" size="sm">
          Nhật ký thay đổi
        </ButtonLink>
      </div>

      {/* 1. Ngưỡng SLA ticket */}
      <Card>
        <SectionTitle>Ngưỡng SLA ticket</SectionTitle>
        <p className="border-b border-border px-4 py-2 text-xs text-fg-muted">
          Thời hạn phản hồi đầu và xử lý xong theo thương hiệu và mức ưu tiên; chỉ áp dụng cho ticket tạo mới sau khi lưu.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">Ngưỡng SLA ticket theo thương hiệu và mức ưu tiên</caption>
            <thead className="bg-bg-subtle">
              <tr className="text-left text-xs font-medium text-fg-muted">
                <th scope="col" className="h-10 border-b border-border px-4 whitespace-nowrap">
                  Thương hiệu
                </th>
                <th scope="col" className="h-10 border-b border-border px-4 whitespace-nowrap">
                  Mức
                </th>
                <th scope="col" className="h-10 border-b border-border px-4 whitespace-nowrap">
                  Phản hồi đầu (giờ)
                </th>
                <th scope="col" className="h-10 border-b border-border px-4 whitespace-nowrap">
                  Xử lý xong (giờ)
                </th>
                <th scope="col" className="h-10 border-b border-border px-4 whitespace-nowrap">
                  Trạng thái
                </th>
                <th scope="col" className="h-10 border-b border-border px-4 whitespace-nowrap">
                  Thiết lập
                </th>
              </tr>
            </thead>
            <tbody>
              {cfg.sla.map((row) => {
                const brandLabel = row.brandId ? (brandCodeById.get(row.brandId) ?? row.brandId) : "Mọi thương hiệu";
                const isNullHours = row.firstResponseHours == null || row.resolveHours == null;
                return (
                  <tr
                    key={`${row.brandId ?? "all"}-${row.priority}`}
                    className="min-h-11 border-b border-border last:border-0 hover:bg-bg-subtle"
                  >
                    <td className="px-4 py-2 font-medium text-fg whitespace-nowrap">{brandLabel}</td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <Badge tone={PRIORITY_TONE[row.priority]}>{PRIORITY_LABEL[row.priority]}</Badge>
                    </td>
                    <td className="tabular px-4 py-2 whitespace-nowrap text-fg">
                      {row.firstResponseHours != null ? (
                        `${row.firstResponseHours} giờ`
                      ) : (
                        <span className="text-xs text-fg-muted">Theo mọi thương hiệu</span>
                      )}
                    </td>
                    <td className="tabular px-4 py-2 whitespace-nowrap text-fg">
                      {row.resolveHours != null ? (
                        `${row.resolveHours} giờ`
                      ) : (
                        <span className="text-xs text-fg-muted">Theo mọi thương hiệu</span>
                      )}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      {row.custom ? (
                        <Badge tone="brand">Tùy chỉnh</Badge>
                      ) : isNullHours ? (
                        <span className="text-xs text-fg-muted">Theo mọi thương hiệu · Mặc định</span>
                      ) : (
                        <span className="text-xs text-fg-muted">Mặc định</span>
                      )}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <SlaForm
                        brandId={row.brandId}
                        priority={row.priority}
                        firstResponseHours={row.firstResponseHours}
                        resolveHours={row.resolveHours}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 2. Phân công lead */}
      <Card>
        <SectionTitle>Phân công nhu cầu mua</SectionTitle>
        <p className="border-b border-border px-4 py-2 text-xs text-fg-muted">
          Thông số chia nhu cầu mua tự động cho nhân viên kinh doanh theo tải mở hiện tại và quy tắc định tuyến nhóm.
        </p>
        <div className="space-y-4 p-4">
          <RoutingForm
            firstResponseHours={cfg.routing.firstResponseHours}
            maxOpenPerUser={cfg.routing.maxOpenPerUser}
            autoCloseDays={cfg.routing.autoCloseDays}
            dedupeDays={cfg.routing.dedupeDays}
          />

          <div className="border-t border-border pt-3">
            <h3 className="mb-2 text-xs font-medium text-fg-muted">
              Quy tắc định tuyến nhóm (thương hiệu · thị trường → nhóm, chỉ đọc)
            </h3>
            {cfg.routing.rules.length === 0 ? (
              <p className="text-xs text-fg-subtle">Chưa có quy tắc định tuyến riêng theo thương hiệu hoặc thị trường.</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {cfg.routing.rules.map((r, i) => (
                  <li
                    key={`${r.brand ?? "*"}:${r.market ?? "*"}:${r.team}:${i}`}
                    className="rounded-[var(--radius-sm)] border border-border bg-bg-subtle px-2.5 py-1 text-xs text-fg"
                  >
                    <span className="font-medium">{r.brand || "mọi"}</span>
                    {" · "}
                    <span className="font-medium">{r.market || "mọi"}</span>
                    {" → "}
                    <span className="font-semibold text-brand-active">{r.team}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Card>

      {/* 3. Giới hạn liên hệ (frequency cap) */}
      <Card>
        <SectionTitle>Giới hạn liên hệ</SectionTitle>
        <p className="border-b border-border px-4 py-2 text-xs text-fg-muted">
          Số tin tối đa được phép gửi cho mỗi khách hàng trên từng kênh trong một chu kỳ ngày (đặt 0 để tạm dừng kênh).
        </p>
        <div className="divide-y divide-border px-4">
          {cfg.caps.map((c) => (
            <CapForm
              key={c.channel}
              channel={c.channel}
              channelLabel={CHANNEL_LABEL[c.channel] ?? c.channel}
              maxCount={c.maxCount}
              windowDays={c.windowDays}
              custom={c.custom}
            />
          ))}
        </div>
      </Card>

      {/* 4. Giờ làm việc theo thị trường */}
      <Card>
        <SectionTitle>Giờ làm việc theo thị trường</SectionTitle>
        <p className="border-b border-border px-4 py-2 text-xs text-fg-muted">
          Tin hành trình ngoài khung được dời tới giờ bắt đầu kế tiếp theo giờ địa phương.
        </p>
        <div className="divide-y divide-border px-4">
          <HoursForm
            market="*"
            label="Mặc định (*)"
            from={cfg.hours.default.from}
            to={cfg.hours.default.to}
            defaultFrom={cfg.hours.default.from}
            defaultTo={cfg.hours.default.to}
          />
          {cfg.hours.byMarket.map((m) => (
            <HoursForm
              key={m.code}
              market={m.code}
              label={`${m.code} · ${m.name} · ${m.timezone} · ${m.locale}`}
              from={m.from}
              to={m.to}
              defaultFrom={cfg.hours.default.from}
              defaultTo={cfg.hours.default.to}
            />
          ))}
        </div>
      </Card>

      {/* 5. Ngưỡng tồn thấp */}
      <Card>
        <SectionTitle>Ngưỡng tồn thấp</SectionTitle>
        <p className="border-b border-border px-4 py-2 text-xs text-fg-muted">
          Ngưỡng cảnh báo tồn kho thấp theo đơn vị sản phẩm cho toàn hệ thống và từng thị trường (để trống = dùng mặc định).
        </p>
        <div className="divide-y divide-border px-4">
          <LowStockForm
            market="*"
            label="Mặc định (*)"
            value={cfg.lowStock.default}
            defaultValue={cfg.lowStock.default}
          />
          {cfg.lowStock.byMarket.map((m) => (
            <LowStockForm
              key={m.code}
              market={m.code}
              label={marketNameByCode.get(m.code) ? `${m.code} · ${marketNameByCode.get(m.code)}` : m.code}
              value={m.value}
              defaultValue={cfg.lowStock.default}
            />
          ))}
        </div>
      </Card>
    </div>
  );
}
