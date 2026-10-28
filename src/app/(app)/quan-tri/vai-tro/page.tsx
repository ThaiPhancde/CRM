import { pageUser } from "@/lib/current-user";
import { can, PERMISSIONS, ROLE_LABEL, ROLES, type Permission } from "@/lib/permissions";
import { Card, PageHeader } from "@/components/ui";

const PERM_LABEL: Record<Permission, string> = {
  "admin.users": "Quản lý người dùng và vai trò",
  "admin.roles": "Xem ma trận quyền",
  "admin.settings": "Sửa danh mục và cấu hình",
  "admin.audit": "Xem nhật ký thao tác",
  "catalog.view": "Xem danh mục",
  "finance.view": "Xem số tiền, tỷ giá, COD",
  "integration.manage": "Quản lý kết nối dữ liệu, chạy đồng bộ",
  "integration.view": "Xem trạng thái kết nối dữ liệu",
  "order.view": "Xem đơn hàng",
  "order.link": "Duyệt gộp/tách đơn nghi trùng",
  "product.view": "Xem sản phẩm",
};

export default async function RolesPage() {
  await pageUser("admin.roles");
  return (
    <>
      <PageHeader title="Vai trò & quyền" crumbs={[{ label: "Hệ thống" }, { label: "Vai trò & quyền" }]}
        description="Vai trò cố định; quyền được kiểm ở máy chủ cho cả giao diện, API, tìm kiếm, báo cáo và AI. Mỗi phase bổ sung quyền của mình." />
      <Card className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">Ma trận vai trò và quyền</caption>
          <thead className="bg-bg-subtle">
            <tr>
              <th scope="col" className="h-10 border-b border-border px-4 text-left text-xs font-medium text-fg-muted">Quyền</th>
              {ROLES.map((r) => <th key={r} scope="col" className="h-10 border-b border-border px-3 text-center text-xs font-medium text-fg-muted whitespace-nowrap">{ROLE_LABEL[r]}</th>)}
            </tr>
          </thead>
          <tbody>
            {PERMISSIONS.map((p) => (
              <tr key={p} className="border-b border-border last:border-0">
                <th scope="row" className="px-4 py-2.5 text-left font-normal">
                  <span className="text-fg">{PERM_LABEL[p]}</span>
                  <span className="ml-2 font-mono text-xs text-fg-subtle">{p}</span>
                </th>
                {ROLES.map((r) => (
                  <td key={r} className="px-3 py-2.5 text-center">
                    {can([r], p) ? <span className="text-brand" aria-label="Có">●</span> : <span className="text-border-strong" aria-label="Không">–</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <p className="mt-3 text-xs text-fg-muted">Quản trị công ty vào được mọi team; ở team chưa được gán vai trò thì mang quyền Quản lý.</p>
    </>
  );
}
