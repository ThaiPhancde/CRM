// Trang tạo bài tri thức mới (khởi tạo bản nháp v1, yêu cầu quyền knowledge.edit).
import { PageHeader } from "@/components/ui";
import { pageUser } from "@/lib/current-user";
import { bindTenant } from "@/lib/db";
import { getCatalog } from "@/modules/admin/service";
import { ArticleEditor } from "../[id]/editor";

export default async function NewKnowledgeArticlePage() {
  const user = await pageUser("knowledge.edit");
  bindTenant(user);

  const catalog = await getCatalog(user);
  const brands = catalog.brands.map((b) => ({
    id: b.id,
    code: b.code,
    name: b.name,
    active: b.active,
  }));
  const markets = catalog.markets.map((m) => ({
    id: m.id,
    code: m.code,
    name: m.name,
    currency: m.currency,
    active: m.active,
  }));

  return (
    <>
      <PageHeader
        title="Viết bài mới"
        crumbs={[
          { label: "Chăm sóc" },
          { href: "/tri-thuc", label: "Tri thức" },
          { label: "Viết bài mới" },
        ]}
        description="Soạn bài hướng dẫn theo brand, thị trường và ngôn ngữ — bài mới sẽ được lưu ở trạng thái bản nháp (v1)"
      />
      <ArticleEditor brands={brands} markets={markets} />
    </>
  );
}
