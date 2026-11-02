"use client";
// Nút "Ghi điểm chạm" + Drawer biểu mẫu ghi điểm chạm khách hàng / nhu cầu mua cho chiến dịch.
import { useActionState, useEffect, useId, useState } from "react";
import { FormError, pick, TextField, type ActionResult } from "@/components/form";
import { Drawer, useToast } from "@/components/overlay";
import { Button } from "@/components/ui";
import { addTouchpointAction } from "../actions";

export function TouchpointForm({ campaignId }: { campaignId: string }) {
  const [open, setOpen] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(addTouchpointAction, null);
  const toast = useToast();
  const formId = useId();

  useEffect(() => {
    setIdempotencyKey(crypto.randomUUID());
  }, []);

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast(state.message ?? "Đã ghi điểm chạm.", "success");
      setIdempotencyKey(crypto.randomUUID());
      setOpen(false);
    } else if (state.message) {
      toast(state.message, "danger");
    }
  }, [state, toast]);

  const handleOpen = () => {
    if (!idempotencyKey) {
      setIdempotencyKey(crypto.randomUUID());
    }
    setOpen(true);
  };

  const d = pick(state, null);
  const v = d.str;
  const f = state?.fields ?? {};

  return (
    <>
      <Button variant="primary" onClick={handleOpen}>
        Ghi điểm chạm
      </Button>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="Ghi điểm chạm"
        description="Ghi nhận lượt tiếp cận khách hàng hoặc nhu cầu mua từ chiến dịch tiếp thị này."
        footer={
          <>
            <Button onClick={() => setOpen(false)}>Hủy</Button>
            <Button variant="primary" type="submit" form={formId} disabled={pending}>
              {pending ? "Đang lưu…" : "Lưu"}
            </Button>
          </>
        }
      >
        <form id={formId} action={action} noValidate>
          <FormError result={state} />
          <input type="hidden" name="campaignId" value={campaignId} />
          <input type="hidden" name="idempotencyKey" value={idempotencyKey} />

          <TextField
            label="SĐT khách"
            name="customerPhone"
            defaultValue={v("customerPhone")}
            placeholder="VD: 0901234567"
            hint="Hoặc để trống nếu nhập mã nhu cầu mua"
            error={f.customerPhone ?? f.customerId}
          />

          <TextField
            label="Mã nhu cầu mua (tùy chọn)"
            name="leadId"
            defaultValue={v("leadId")}
            placeholder="Nhập mã nhu cầu mua (nếu có)"
            error={f.leadId}
          />

          <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
            <TextField
              label="Nguồn tiếp cận (source)"
              name="source"
              required
              maxLength={60}
              defaultValue={v("source")}
              placeholder="newsletter, facebook…"
              error={f.source}
            />
            <TextField
              label="Kênh trung gian (medium)"
              name="medium"
              maxLength={60}
              defaultValue={v("medium")}
              placeholder="cpc, email, social…"
              error={f.medium}
            />
          </div>

          <TextField
            label="Nội dung UTM (utm_content)"
            name="utmContent"
            maxLength={120}
            defaultValue={v("utmContent")}
            placeholder="banner_top, video_01…"
            error={f.utmContent}
          />

          <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
            <TextField
              label="Chi phí"
              name="cost"
              inputMode="decimal"
              defaultValue={v("cost")}
              placeholder="0"
              error={f.cost}
            />
            <TextField
              label="Tiền tệ chi phí"
              name="costCurrency"
              maxLength={3}
              defaultValue={v("costCurrency")}
              placeholder="VND"
              error={f.costCurrency}
            />
          </div>

          <TextField
            label="Thời điểm"
            name="occurredAt"
            type="datetime-local"
            defaultValue={v("occurredAt")}
            hint="Để trống sẽ lấy thời điểm hiện tại"
            error={f.occurredAt}
          />
        </form>
      </Drawer>
    </>
  );
}
