"use client";
// Nút mở Drawer + biểu mẫu tạo/sửa chiến dịch tiếp thị (Phase 7).
import { useActionState, useEffect, useId, useState } from "react";
import { FormError, pick, SelectField, TextField, type ActionResult } from "@/components/form";
import { Drawer, useToast } from "@/components/overlay";
import { Button } from "@/components/ui";
import type { CampaignDetail, campaignOptions } from "@/modules/marketing/campaigns";
import { CAMPAIGN_CHANNELS, JOURNEY_STATUS_LABEL } from "@/modules/marketing/labels";
import { saveCampaignAction } from "./actions";

export type CampaignOptions = Awaited<ReturnType<typeof campaignOptions>>;

export function CampaignForm({
  options,
  initial,
}: {
  options: CampaignOptions;
  initial?: CampaignDetail;
}) {
  const isEdit = Boolean(initial);
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(saveCampaignAction, null);
  const toast = useToast();
  const formId = useId();

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast(state.message ?? "Đã lưu chiến dịch.", "success");
      setOpen(false);
    } else if (state.message) {
      toast(state.message, "danger");
    }
  }, [state, toast]);

  const d = pick(state, initial);
  const v = d.str;
  const f = state?.fields ?? {};

  const brandOptions = options.brands.map((b) => ({
    value: b.id,
    label: `${b.code} · ${b.name}`,
  }));

  const segmentOptions = options.segments.map((s) => ({
    value: s.id,
    label: s.lastCount != null ? `${s.name} · ${s.lastCount} khách` : s.name,
  }));

  const journeyOptions = options.journeys.map((j) => ({
    value: j.id,
    label: `${j.name} · ${JOURNEY_STATUS_LABEL[j.status]}`,
  }));

  return (
    <>
      <Button variant={isEdit ? "secondary" : "primary"} onClick={() => setOpen(true)}>
        {isEdit ? "Sửa" : "Tạo chiến dịch"}
      </Button>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title={isEdit ? "Sửa chiến dịch" : "Tạo chiến dịch"}
        description="Gắn phân khúc khách hàng, hành trình chăm sóc, kênh tiếp cận và chi phí chiến dịch."
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
          {initial && <input type="hidden" name="id" value={initial.id} />}

          <TextField
            label="Tên chiến dịch"
            name="name"
            required
            maxLength={120}
            defaultValue={v("name")}
            placeholder="VD: Chăm sóc khách mua lại quý 4…"
            error={f.name}
          />

          <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
            <SelectField
              label="Kênh tiếp cận"
              name="channel"
              required
              defaultValue={v("channel") || CAMPAIGN_CHANNELS[0]?.value}
              options={CAMPAIGN_CHANNELS}
              error={f.channel}
            />
            <SelectField
              label="Brand"
              name="brandId"
              placeholder="— Không —"
              defaultValue={v("brandId")}
              options={brandOptions}
              error={f.brandId}
            />
          </div>

          <SelectField
            label="Phân khúc khách hàng"
            name="segmentId"
            placeholder="— Không —"
            defaultValue={v("segmentId")}
            options={segmentOptions}
            error={f.segmentId}
          />

          <SelectField
            label="Hành trình chăm sóc"
            name="journeyId"
            placeholder="— Không —"
            defaultValue={v("journeyId")}
            options={journeyOptions}
            error={f.journeyId}
          />

          <TextField
            label="Mã chiến dịch UTM (utm_campaign)"
            name="utmCampaign"
            maxLength={80}
            defaultValue={v("utmCampaign")}
            placeholder="vd: repurchase_q4_2026"
            hint="chữ thường, số, - và _"
            error={f.utmCampaign}
          />

          <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
            <TextField
              label="Ngày bắt đầu"
              name="startAt"
              type="date"
              defaultValue={v("startAt").slice(0, 10)}
              error={f.startAt}
            />
            <TextField
              label="Ngày kết thúc"
              name="endAt"
              type="date"
              defaultValue={v("endAt").slice(0, 10)}
              error={f.endAt}
            />
          </div>

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
        </form>
      </Drawer>
    </>
  );
}
