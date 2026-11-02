// Sửa hành trình (chỉ khi Nháp hoặc Tạm dừng — đang chạy thì service từ chối).
import { notFound } from "next/navigation";
import { EmptyState, ButtonLink, PageHeader } from "@/components/ui";
import { pageUser } from "@/lib/current-user";
import { bindTenant } from "@/lib/db";
import { HttpError } from "@/lib/errors";
import { getJourney } from "@/modules/marketing/journeys";
import { listSegments, segmentFields } from "@/modules/marketing/segments";
import { JourneyEditor } from "../../journey-editor";

export default async function EditJourneyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await pageUser("journey.manage");
  bindTenant(user);
  const j = await getJourney(user, id).catch((e) => { if (e instanceof HttpError && e.status === 404) notFound(); throw e; });
  const crumbs = [{ label: "Marketing" }, { href: "/hanh-trinh", label: "Hành trình" }, { href: `/hanh-trinh/${id}`, label: j.name }, { label: "Sửa" }];
  if (j.status === "ACTIVE") {
    return (
      <>
        <PageHeader title={`Sửa "${j.name}"`} crumbs={crumbs} />
        <EmptyState title="Hành trình đang chạy" description="Tạm dừng trước khi sửa bước, để khách đang ở giữa hành trình không nhảy sai bước." action={<ButtonLink href={`/hanh-trinh/${id}`}>Về trang hành trình</ButtonLink>} />
      </>
    );
  }
  const [segments, fields] = await Promise.all([listSegments(user), segmentFields(user)]);
  return (
    <>
      <PageHeader title={`Sửa "${j.name}"`} crumbs={crumbs} />
      <JourneyEditor
        segments={segments}
        brands={fields.find((f) => f.key === "brand")?.options ?? []}
        fields={fields}
        initial={{ id: j.id, name: j.name, description: j.description ?? "", segmentId: j.segment.id, brandId: j.brandId ?? "", reentryDays: j.reentryDays, exitRules: j.exitRules, steps: j.steps }}
      />
    </>
  );
}
