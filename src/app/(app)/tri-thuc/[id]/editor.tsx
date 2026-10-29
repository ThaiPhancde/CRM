"use client";
// Biểu mẫu soạn thảo bài tri thức (tạo mới bản nháp v1 hoặc lưu phiên bản mới khi chỉnh sửa).
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { Field, FormError, pick, SelectField, TextField, type ActionResult } from "@/components/form";
import { useToast } from "@/components/overlay";
import { Button, ButtonLink, Card, cx, SectionTitle } from "@/components/ui";
import { LANGUAGES } from "@/modules/sales/labels";
import { saveArticleAction } from "../actions";

export type BrandOption = { id: string; code: string; name: string; active: boolean };
export type MarketOption = { id: string; code: string; name: string; currency: string; active: boolean };

export type ArticleEditorInitial = {
  id?: string;
  title?: string;
  body?: string;
  language?: string;
  brandId?: string | null;
  marketId?: string | null;
  tags?: string[];
  currentVersion?: number;
  latestVersion?: number;
};

const LANGUAGE_LABEL: Record<(typeof LANGUAGES)[number], string> = {
  vi: "Tiếng Việt",
  en: "English",
  ar: "العربية",
  de: "Deutsch",
};

const LANGUAGE_OPTIONS = LANGUAGES.map((lg) => ({
  value: lg,
  label: LANGUAGE_LABEL[lg],
}));

export function ArticleEditor({
  brands,
  markets,
  initial,
}: {
  brands: BrandOption[];
  markets: MarketOption[];
  initial?: ArticleEditorInitial;
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(saveArticleAction, null);
  const [createdSuccess, setCreatedSuccess] = useState(false);
  const toast = useToast();
  const router = useRouter();
  const isEditing = Boolean(initial?.id);

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      if (isEditing && initial?.id) {
        toast(state.message ?? "Đã lưu phiên bản mới.", "success");
        router.push(`/tri-thuc/${initial.id}`);
        router.refresh();
      } else {
        toast("Đã tạo bài", "success");
        setCreatedSuccess(true);
      }
    } else if (state.message) {
      toast(state.message, "danger");
    }
  }, [state, toast, isEditing, initial?.id, router]);

  const d = pick(state, {
    title: initial?.title ?? "",
    language: initial?.language ?? "vi",
    brandId: initial?.brandId ?? "",
    marketId: initial?.marketId ?? "",
    tags: initial?.tags?.join(", ") ?? "",
    body: initial?.body ?? "",
  });
  const v = d.str;
  const f = state?.fields ?? {};

  return (
    <Card>
      <SectionTitle
        actions={
          <ButtonLink
            href={isEditing && initial?.id ? `/tri-thuc/${initial.id}` : "/tri-thuc"}
            size="sm"
          >
            {isEditing ? "Hủy chỉnh sửa" : "Về danh sách"}
          </ButtonLink>
        }
      >
        {isEditing
          ? `Soạn phiên bản mới (từ bản v${initial?.currentVersion ?? initial?.latestVersion ?? 1})`
          : "Nội dung bài tri thức mới"}
      </SectionTitle>

      <form action={action} noValidate className="p-5">
        <FormError result={state} />
        <input type="hidden" name="id" value={initial?.id ?? ""} />

        {createdSuccess && !isEditing && (
          <div
            role="status"
            className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-success/30 bg-success-soft px-4 py-3 text-sm text-success"
          >
            <span>Đã tạo bài tri thức (bản nháp v1). Bạn có thể quay về danh sách để kiểm tra và xuất bản.</span>
            <ButtonLink href="/tri-thuc" variant="primary" size="sm">
              Về danh sách
            </ButtonLink>
          </div>
        )}

        <div className="grid grid-cols-1 gap-x-4 md:grid-cols-3">
          <div className="md:col-span-2">
            <TextField
              label="Tiêu đề bài viết"
              name="title"
              required
              maxLength={200}
              defaultValue={v("title")}
              placeholder="VD: Chính sách xác nhận đơn COD tại thị trường Trung Đông…"
              error={f.title}
            />
          </div>

          <SelectField
            label="Ngôn ngữ"
            name="language"
            required
            defaultValue={v("language") || "vi"}
            options={LANGUAGE_OPTIONS}
            error={f.language}
          />
        </div>

        <div className="grid grid-cols-1 gap-x-4 md:grid-cols-3">
          <SelectField
            label="Brand"
            name="brandId"
            defaultValue={v("brandId")}
            placeholder="— Mọi brand —"
            options={brands
              .filter((b) => b.active || b.id === v("brandId"))
              .map((b) => ({ value: b.id, label: `${b.code} · ${b.name}` }))}
            error={f.brandId}
          />

          <SelectField
            label="Thị trường"
            name="marketId"
            defaultValue={v("marketId")}
            placeholder="— Mọi thị trường —"
            options={markets
              .filter((m) => m.active || m.id === v("marketId"))
              .map((m) => ({ value: m.id, label: `${m.code} · ${m.name} (${m.currency})` }))}
            error={f.marketId}
          />

          <TextField
            label="Thẻ phân loại (tags)"
            name="tags"
            maxLength={300}
            defaultValue={v("tags")}
            placeholder="cod, giao-hang, doi-tra"
            hint="Phân cách bằng dấu phẩy, tối đa 10 thẻ"
            error={f.tags}
          />
        </div>

        <Field
          label="Nội dung bài viết"
          name="body"
          required
          error={f.body}
          hint="Markdown đơn giản: # tiêu đề, - gạch đầu dòng"
        >
          <textarea
            id="body"
            name="body"
            required
            rows={18}
            maxLength={50000}
            dir="auto"
            defaultValue={v("body")}
            placeholder={"# Mục tiêu hướng dẫn\n\nMô tả ngắn gọn quy trình xử lý cho nhân viên chăm sóc khách hàng.\n\n- Bước 1: Kiểm tra trạng thái đơn hàng\n- Bước 2: Đối chiếu chính sách theo thị trường"}
            aria-invalid={!!f.body}
            aria-describedby={f.body ? "body-error" : undefined}
            className={cx(
              "w-full rounded-[var(--radius-sm)] border bg-bg px-3 py-2 font-mono text-sm leading-relaxed text-fg placeholder:text-fg-subtle focus:border-brand-ring",
              f.body ? "border-danger" : "border-border",
            )}
          />
        </Field>

        <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
          <ButtonLink href={isEditing && initial?.id ? `/tri-thuc/${initial.id}` : "/tri-thuc"}>
            {isEditing ? "Hủy" : "Về danh sách"}
          </ButtonLink>
          <Button type="submit" variant="primary" disabled={pending}>
            {pending
              ? "Đang lưu…"
              : isEditing
                ? `Lưu phiên bản v${(initial?.latestVersion ?? 1) + 1}`
                : "Tạo bài viết (bản nháp)"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
