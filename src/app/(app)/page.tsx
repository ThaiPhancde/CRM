import { bindTenant, db, rootDb } from "@/lib/db";
import { currentUserOrRedirect } from "@/lib/current-user";
import { can } from "@/lib/permissions";
import { Badge, Card, PageHeader, SectionTitle, StatCard } from "@/components/ui";

// Dashboard theo vai là Phase 9. Phase 1 chỉ hiện danh mục của team + lộ trình demo để người dùng thấy phạm vi.
const ROADMAP = [
  { p: 1, name: "Nền tảng, quyền, giao diện", done: true },
  { p: 2, name: "Kết nối dữ liệu + đơn chuẩn", done: true },
  { p: 3, name: "Customer 360", done: true },
  { p: 4, name: "Nhu cầu mua + không gian sales" },
  { p: 5, name: "Dịch vụ sau bán + tri thức" },
  { p: 6, name: "Chỉ số, chấm điểm, Warehouse" },
  { p: 7, name: "Điều phối chăm sóc + marketing" },
  { p: 8, name: "Trung tâm AI" },
  { p: 9, name: "Báo cáo + dashboard" },
  { p: 10, name: "Vận đơn + sản phẩm" },
  { p: 11, name: "Quản trị, rà soát, chạy thử demo" },
];

export default async function HomePage() {
  const user = await currentUserOrRedirect();
  bindTenant(user);
  const [brands, stores, markets, members] = await Promise.all([
    db.brand.count({ where: { active: true } }),
    db.store.findMany({ where: { active: true }, select: { platform: true } }),
    db.market.findMany({ where: { active: true }, select: { code: true, paymentMode: true } }),
    rootDb.membership.count({ where: { workspaceId: user.workspaceId, active: true } }),
  ]);
  const platforms = [...new Set(stores.map((s) => s.platform))];
  const admin = can(user.roles, "admin.settings");

  return (
    <>
      <PageHeader title={`Xin chào, ${user.name.split(" ").slice(-1)[0]}`} description={`Bạn đang làm việc trong ${user.workspace.name}.`} />
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Brand đang hoạt động" value={brands} href={admin ? "/quan-tri/danh-muc?tab=brand" : undefined} />
        <StatCard label="Shop / cửa hàng" value={stores.length} hint={platforms.length ? `Nền tảng: ${platforms.join(", ")}` : "Chưa có"} href={admin ? "/quan-tri/danh-muc?tab=store" : undefined} />
        <StatCard label="Thị trường" value={markets.length} hint={markets.map((m) => m.code).join(" · ") || "Chưa có"} href={admin ? "/quan-tri/danh-muc?tab=market" : undefined} />
        <StatCard label="Thành viên" value={members} href={can(user.roles, "admin.users") ? "/quan-tri/nguoi-dung" : undefined} />
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <SectionTitle actions={<Badge tone="brand">Bản demo</Badge>}>Lộ trình bản demo</SectionTitle>
          <ol className="divide-y divide-border">
            {ROADMAP.map((r) => (
              <li key={r.p} className="flex items-center gap-3 px-4 py-2.5">
                <span className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${r.done ? "bg-brand text-white" : "bg-bg-muted text-fg-muted"}`}>{r.p}</span>
                <span className={`flex-1 text-sm ${r.done ? "font-medium text-fg" : "text-fg-muted"}`}>{r.name}</span>
                {r.done ? <Badge tone="success">Đã có</Badge> : <Badge>Sắp có</Badge>}
              </li>
            ))}
          </ol>
        </Card>
        <Card>
          <SectionTitle>Chế độ demo</SectionTitle>
          <dl className="space-y-3 px-4 py-4 text-sm">
            <Row k="Dữ liệu nguồn" v="Phát lại từ dữ liệu mẫu" />
            <Row k="Gửi email / tin nhắn" v="Chỉ mô phỏng, không gửi ra ngoài" />
            <Row k="Ghi ngược nền tảng bán" v="Tắt" />
            <Row k="Phân tích" v="PostgreSQL (BigQuery khi lên thật)" />
            <Row k="AI" v="Phát lại kết quả mẫu" />
          </dl>
        </Card>
      </div>
    </>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-xs text-fg-muted">{k}</dt>
      <dd className="font-medium text-fg">{v}</dd>
    </div>
  );
}
