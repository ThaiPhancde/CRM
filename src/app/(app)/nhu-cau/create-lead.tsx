"use client";
// Nút "Tạo nhu cầu mua" + Drawer biểu mẫu tạo mới (có khóa idempotency sinh một lần mỗi khi mở drawer).
import { useActionState, useEffect, useState } from "react";
import { Field, FormError, pick, SelectField, TextField, type ActionResult } from "@/components/form";
import { Drawer, useToast } from "@/components/overlay";
import { Button, cx } from "@/components/ui";
import { LANGUAGES } from "@/modules/sales/labels";
import { createLeadAction } from "./actions";

export type BrandOption = { id: string; code: string; name: string; active: boolean };
export type MarketOption = { id: string; code: string; name: string; currency: string; active: boolean };

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

const SOURCE_OPTIONS = [
  { value: "inbox", label: "Hộp thư" },
  { value: "website", label: "Website" },
  { value: "ads", label: "Quảng cáo" },
  { value: "referral", label: "Giới thiệu" },
  { value: "manual", label: "Nhập tay" },
];

const textareaClass =
  "w-full rounded-[var(--radius-sm)] border bg-bg px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus:border-brand-ring disabled:bg-bg-muted";

export function CreateLead({ brands, markets }: { brands: BrandOption[]; markets: MarketOption[] }) {
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);

  const handleOpen = () => {
    setIdempotencyKey(crypto.randomUUID());
  };

  const handleClose = () => {
    setIdempotencyKey(null);
  };

  return (
    <>
      <Button variant="primary" onClick={handleOpen}>
        Tạo nhu cầu mua
      </Button>
      {idempotencyKey !== null && (
        <CreateLeadDrawer
          key={idempotencyKey}
          open
          idempotencyKey={idempotencyKey}
          brands={brands}
          markets={markets}
          onClose={handleClose}
        />
      )}
    </>
  );
}

function CreateLeadDrawer({
  open,
  idempotencyKey,
  brands,
  markets,
  onClose,
}: {
  open: boolean;
  idempotencyKey: string;
  brands: BrandOption[];
  markets: MarketOption[];
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(createLeadAction, null);
  const toast = useToast();

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast(state.message ?? "Đã tạo nhu cầu mua và giao người phụ trách.", "success");
      onClose();
    } else if (state.message) {
      toast(state.message, "danger");
    }
  }, [state, toast, onClose]);

  const d = pick(state, { source: "inbox" });
  const v = d.str;
  const f = state?.fields ?? {};

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Tạo nhu cầu mua"
      description="Nhập thông tin khách hàng tiềm năng để phân công tư vấn và theo dõi hạn phản hồi."
      footer={
        <>
          <Button onClick={onClose}>Hủy</Button>
          <Button variant="primary" type="submit" form="create-lead-form" disabled={pending}>
            {pending ? "Đang lưu…" : "Tạo nhu cầu mua"}
          </Button>
        </>
      }
    >
      <form id="create-lead-form" action={action} noValidate>
        <FormError result={state} />
        <input type="hidden" name="idempotencyKey" value={idempotencyKey} />

        <TextField
          label="Tên liên hệ"
          name="contactName"
          required
          maxLength={120}
          defaultValue={v("contactName")}
          placeholder="VD: Nguyễn Văn An, Ahmed Al-Mansoor…"
          error={f.contactName}
        />

        <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
          <TextField
            label="Số điện thoại"
            name="phone"
            type="tel"
            maxLength={40}
            defaultValue={v("phone")}
            placeholder="+971501234567"
            hint="Kèm mã quốc gia, ví dụ +971…"
            error={f.phone}
          />
          <TextField
            label="Email"
            name="email"
            type="email"
            maxLength={200}
            defaultValue={v("email")}
            placeholder="khach@example.com"
            hint="Cần ít nhất SĐT hoặc email"
            error={f.email}
          />
        </div>

        <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
          <SelectField
            label="Nguồn"
            name="source"
            required
            defaultValue={v("source") || "inbox"}
            options={SOURCE_OPTIONS}
            error={f.source}
          />
          <SelectField
            label="Ngôn ngữ"
            name="language"
            defaultValue={v("language")}
            placeholder="— Chọn ngôn ngữ —"
            options={LANGUAGE_OPTIONS}
            error={f.language}
          />
        </div>

        <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
          <SelectField
            label="Brand"
            name="brandId"
            defaultValue={v("brandId")}
            placeholder="— Chọn brand —"
            options={brands
              .filter((b) => b.active || b.id === v("brandId"))
              .map((b) => ({ value: b.id, label: `${b.code} · ${b.name}` }))}
            error={f.brandId}
          />
          <SelectField
            label="Thị trường"
            name="marketId"
            defaultValue={v("marketId")}
            placeholder="— Chọn thị trường —"
            options={markets
              .filter((m) => m.active || m.id === v("marketId"))
              .map((m) => ({ value: m.id, label: `${m.code} · ${m.name} (${m.currency})` }))}
            error={f.marketId}
          />
        </div>

        <Field label="Nhu cầu quan tâm" name="interest" error={f.interest}>
          <textarea
            id="interest"
            name="interest"
            rows={2}
            maxLength={500}
            defaultValue={v("interest")}
            placeholder="Sản phẩm, mẫu mã hoặc vấn đề khách đang hỏi…"
            aria-invalid={!!f.interest}
            className={cx(textareaClass, f.interest ? "border-danger" : "border-border")}
          />
        </Field>

        <div className="grid grid-cols-3 gap-x-3">
          <div className="col-span-2">
            <TextField
              label="Ngân sách dự kiến"
              name="budgetAmount"
              inputMode="decimal"
              defaultValue={v("budgetAmount")}
              placeholder="150.00"
              error={f.budgetAmount}
            />
          </div>
          <TextField
            label="Tiền tệ"
            name="budgetCurrency"
            maxLength={3}
            defaultValue={v("budgetCurrency")}
            placeholder="AED"
            error={f.budgetCurrency}
          />
        </div>

        <Field label="Ghi chú đầu tiên" name="note" error={f.note}>
          <textarea
            id="note"
            name="note"
            rows={3}
            maxLength={2000}
            defaultValue={v("note")}
            placeholder="Ghi chú nội bộ hoặc tóm tắt tin nhắn đầu của khách…"
            aria-invalid={!!f.note}
            className={cx(textareaClass, f.note ? "border-danger" : "border-border")}
          />
        </Field>
      </form>
    </Drawer>
  );
}
