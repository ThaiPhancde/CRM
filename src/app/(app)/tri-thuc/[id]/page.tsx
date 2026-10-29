// Trang đọc chi tiết bài tri thức theo phiên bản (?v=N) và chế độ chỉnh sửa (?edit=1) cho người có quyền soạn thảo.
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Badge, ButtonLink, Card, cx, EmptyState, PageHeader, SectionTitle, type Tone } from "@/components/ui";
import { pageUser } from "@/lib/current-user";
import { bindTenant } from "@/lib/db";
import { HttpError } from "@/lib/errors";
import { dateTime, num } from "@/lib/format";
import { getCatalog } from "@/modules/admin/service";
import { getArticle, type ArticleDetail } from "@/modules/service/knowledge";
import { KNOWLEDGE_STATUS_LABEL } from "@/modules/service/labels";
import { ArticleEditor } from "./editor";
import { PublishButtons } from "./publish-buttons";

const LANGUAGE_LABEL: Record<string, string> = {
  vi: "Tiếng Việt",
  en: "English",
  ar: "العربية",
  de: "Deutsch",
};

const STATUS_TONE: Record<string, Tone> = {
  DRAFT: "warning",
  PUBLISHED: "success",
  ARCHIVED: "neutral",
};

/**
 * Hiển thị nội dung Markdown đơn giản thành các khối văn bản thuần (React text),
 * tuyệt đối không chèn HTML: tách theo dòng trống; "# " / "## " thành tiêu đề;
 * dòng bắt đầu bằng "- " thành danh sách <li>; các dòng còn lại thành <p>.
 */
function renderMarkdownBody(body: string): ReactNode[] {
  const blocks = body
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  const elements: ReactNode[] = [];

  blocks.forEach((block, blockIdx) => {
    const lines = block.split("\n");
    let listItems: string[] = [];
    let paragraphLines: string[] = [];
    let partIdx = 0;

    const flushList = () => {
      if (listItems.length === 0) return;
      const items = listItems;
      listItems = [];
      elements.push(
        <ul
          key={`b-${blockIdx}-ul-${partIdx++}`}
          dir="auto"
          className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-fg"
        >
          {items.map((item, i) => (
            <li key={i} dir="auto">
              {item}
            </li>
          ))}
        </ul>,
      );
    };

    const flushParagraph = () => {
      if (paragraphLines.length === 0) return;
      const text = paragraphLines.join("\n");
      paragraphLines = [];
      elements.push(
        <p
          key={`b-${blockIdx}-p-${partIdx++}`}
          dir="auto"
          className="whitespace-pre-line text-sm leading-relaxed text-fg"
        >
          {text}
        </p>,
      );
    };

    for (const rawLine of lines) {
      const line = rawLine.trimEnd();
      if (!line.trim()) continue;

      if (line.startsWith("# ")) {
        flushList();
        flushParagraph();
        elements.push(
          <h2
            key={`b-${blockIdx}-h1-${partIdx++}`}
            dir="auto"
            className=" pt-1 text-lg font-semibold tracking-tight text-fg"
          >
            {line.slice(2).trim()}
          </h2>,
        );
      } else if (line.startsWith("## ")) {
        flushList();
        flushParagraph();
        elements.push(
          <h3
            key={`b-${blockIdx}-h2-${partIdx++}`}
            dir="auto"
            className="pt-1 text-base font-semibold text-fg"
          >
            {line.slice(3).trim()}
          </h3>,
        );
      } else if (line.startsWith("- ")) {
        flushParagraph();
        listItems.push(line.slice(2).trim());
      } else {
        flushList();
        paragraphLines.push(line);
      }
    }

    flushList();
    flushParagraph();
  });

  return elements;
}

export default async function KnowledgeArticlePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await pageUser("knowledge.view");
  bindTenant(user);

  const { id } = await params;
  const sp = await searchParams;

  const vRaw = Array.isArray(sp.v) ? sp.v[0] : sp.v;
  const parsedV = vRaw ? Number(vRaw) : undefined;
  const requestedVersion =
    parsedV && Number.isInteger(parsedV) && parsedV > 0 ? parsedV : undefined;

  const editRaw = Array.isArray(sp.edit) ? sp.edit[0] : sp.edit;
  const wantEdit = editRaw === "1";

  let article: ArticleDetail;
  try {
    article = await getArticle(user, id, requestedVersion);
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound();
    throw e;
  }

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

  const brandObj = article.brandId ? brands.find((b) => b.id === article.brandId) : null;
  const marketObj = article.marketId ? markets.find((m) => m.id === article.marketId) : null;

  const brandDisplay = article.brandId
    ? brandObj
      ? `${brandObj.code} · ${brandObj.name}`
      : article.brandId
    : "—";
  const marketDisplay = article.marketId
    ? marketObj
      ? `${marketObj.code} · ${marketObj.name}`
      : article.marketId
    : "—";

  const statusTone = STATUS_TONE[article.status] ?? "neutral";
  const statusLabel = KNOWLEDGE_STATUS_LABEL[article.status] ?? article.status;
  const languageLabel = LANGUAGE_LABEL[article.language] ?? article.language;
  const hasNewerDraft =
    article.publishedVersion != null && article.latestVersion > article.publishedVersion;

  if (wantEdit && article.canEdit) {
    return (
      <>
        <PageHeader
          title={`Sửa bài: ${article.version.title}`}
          crumbs={[
            { label: "Chăm sóc" },
            { href: "/tri-thuc", label: "Tri thức" },
            { href: `/tri-thuc/${article.id}`, label: article.title },
            { label: `Sửa từ v${article.version.version}` },
          ]}
          description={`Mỗi lần lưu sẽ tạo phiên bản mới (v${article.latestVersion + 1}). Bản đang xuất bản không bị ảnh hưởng cho tới khi bạn bấm xuất bản.`}
        />
        <ArticleEditor
          brands={brands}
          markets={markets}
          initial={{
            id: article.id,
            title: article.version.title,
            body: article.version.body,
            language: article.language,
            brandId: article.brandId,
            marketId: article.marketId,
            tags: article.tags,
            currentVersion: article.version.version,
            latestVersion: article.latestVersion,
          }}
        />
      </>
    );
  }

  const renderedBlocks = renderMarkdownBody(article.version.body);

  return (
    <>
      <PageHeader
        title={article.version.title}
        crumbs={[
          { label: "Chăm sóc" },
          { href: "/tri-thuc", label: "Tri thức" },
          { label: article.version.title },
        ]}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <Badge tone={statusTone}>{statusLabel}</Badge>
            {hasNewerDraft && <Badge tone="info">Có bản nháp mới</Badge>}
            <span>·</span>
            <span>Ngôn ngữ: {languageLabel}</span>
            <span>·</span>
            <span className="tabular">
              Phiên bản v{article.version.version} ({dateTime(article.version.createdAt)})
            </span>
          </span>
        }
        actions={
          <ButtonLink href="/tri-thuc" variant="secondary">
            Về danh sách
          </ButtonLink>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Cột trái 2/3: Nội dung bài viết */}
        <div className="space-y-4 xl:col-span-2">
          {article.canEdit &&
            article.publishedVersion != null &&
            article.version.version !== article.publishedVersion && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-sm)] border border-warning/30 bg-warning-soft px-4 py-2.5 text-xs text-warning">
                <span>
                  Bạn đang xem <strong>phiên bản v{article.version.version}</strong> (chưa phải bản đang xuất bản cho người đọc là{" "}
                  <strong>v{article.publishedVersion}</strong>).
                </span>
                <Link
                  href={`/tri-thuc/${article.id}?v=${article.publishedVersion}`}
                  className="font-medium underline"
                >
                  Xem bản đang xuất bản (v{article.publishedVersion})
                </Link>
              </div>
            )}

          <Card>
            <SectionTitle>Nội dung hướng dẫn</SectionTitle>
            {renderedBlocks.length === 0 ? (
              <EmptyState
                title="Bài viết chưa có nội dung"
                description="Phiên bản này hiện chưa có văn bản hướng dẫn."
              />
            ) : (
              <article dir="auto" className="space-y-3 px-6 py-5">
                {renderedBlocks}
              </article>
            )}
          </Card>
        </div>

        {/* Cột phải 1/3: Thông tin bài viết, nút thao tác và lịch sử phiên bản */}
        <div className="space-y-4">
          <Card>
            <SectionTitle>Thông tin bài viết</SectionTitle>
            <dl className="space-y-2.5 px-4 py-3 text-sm">
              <InfoRow
                label="Trạng thái"
                value={
                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                    <Badge tone={statusTone}>{statusLabel}</Badge>
                    {hasNewerDraft && <Badge tone="info">Có bản nháp mới</Badge>}
                  </div>
                }
              />
              <InfoRow label="Ngôn ngữ" value={languageLabel} />
              <InfoRow label="Brand" value={brandDisplay} />
              <InfoRow label="Thị trường" value={marketDisplay} />
              <InfoRow
                label="Phiên bản đang xem"
                value={<span className="tabular font-medium">v{article.version.version}</span>}
              />
              <InfoRow
                label="Bản đang xuất bản"
                value={
                  <span className="tabular">
                    {article.publishedVersion != null ? `v${article.publishedVersion}` : "—"}
                  </span>
                }
              />
              <InfoRow
                label="Bản mới nhất"
                value={<span className="tabular">v{article.latestVersion}</span>}
              />
              <InfoRow
                label="Thẻ phân loại"
                value={
                  article.tags.length > 0 ? (
                    <div className="flex flex-wrap justify-end gap-1">
                      {article.tags.map((tag) => (
                        <Badge key={tag} tone="neutral">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    "—"
                  )
                }
              />
            </dl>

            {article.canEdit && (
              <div className="border-t border-border px-4 py-3">
                <PublishButtons
                  articleId={article.id}
                  viewingVersion={article.version.version}
                  publishedVersion={article.publishedVersion}
                  status={article.status}
                  canEdit={article.canEdit}
                  canPublish={article.canPublish}
                />
              </div>
            )}
          </Card>

          {article.canEdit && (
            <Card>
              <SectionTitle>Lịch sử phiên bản ({num(article.versions.length)})</SectionTitle>
              {article.versions.length === 0 ? (
                <p className="px-4 py-4 text-sm text-fg-muted">Chưa có lịch sử phiên bản.</p>
              ) : (
                <ul className="divide-y divide-border text-sm">
                  {article.versions.map((ver) => {
                    const isViewing = ver.version === article.version.version;
                    const isPublished =
                      article.status === "PUBLISHED" && ver.version === article.publishedVersion;
                    return (
                      <li
                        key={ver.version}
                        className={cx("px-4 py-3", isViewing && "bg-brand-soft/50")}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <Link
                            href={`/tri-thuc/${article.id}?v=${ver.version}`}
                            className="font-medium text-brand-active hover:underline"
                          >
                            Phiên bản v{ver.version}: {ver.title}
                          </Link>
                          <div className="flex items-center gap-1.5">
                            {isPublished && <Badge tone="success">Đang xuất bản</Badge>}
                            {isViewing && <Badge tone="brand">Đang xem</Badge>}
                          </div>
                        </div>
                        <p className="mt-1 text-xs text-fg-muted">
                          <span>Người soạn: {ver.author ?? "Hệ thống"}</span>
                          {" · "}
                          <span className="tabular">{dateTime(ver.createdAt)}</span>
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-fg-muted">{label}</dt>
      <dd className="min-w-0 text-right text-fg">{value}</dd>
    </div>
  );
}
