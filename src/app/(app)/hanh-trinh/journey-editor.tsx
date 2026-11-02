"use client";
// Trình soạn hành trình: thông tin chung + luật thoát + danh sách bước tuyến tính (thêm, đổi thứ tự, xóa).
// Gửi một trường `payload` JSON; service kiểm lại toàn bộ (zod) và chặn sửa khi đang chạy.
import { useActionState, useEffect, useState } from "react";
import type { ExitRules, Step } from "@/modules/marketing/journeys";
import type { SegmentField } from "@/modules/marketing/segments";
import { CHANNEL_LABEL, CHANNELS, STEP_LABEL, STEP_TYPES, TEMPLATE_KEYS, type StepType } from "@/modules/marketing/labels";
import { Field, FormError, TextField, type ActionResult } from "@/components/form";
import { useToast } from "@/components/overlay";
import { Button, ButtonLink, Card, cx, SectionTitle } from "@/components/ui";
import { emptyRule, RuleBuilder } from "../phan-khuc/rule-builder";
import { saveJourneyAction } from "./actions";

const ctl = "h-9 rounded-[var(--radius-sm)] border border-border bg-bg px-2 text-sm text-fg focus:border-brand-ring";

export type JourneyDraft = { id?: string; name: string; description: string; segmentId: string; brandId: string; reentryDays: number; exitRules: ExitRules; steps: Step[] };

function newStep(type: StepType, fields: SegmentField[]): Step {
  switch (type) {
    case "WAIT": return { type, days: 3 };
    case "CONDITION": return { type, label: "Chưa mua lại", rules: { op: "and", rules: [emptyRule(fields)] } };
    case "SEND": return { type, channel: "EMAIL", template: TEMPLATE_KEYS[0].value };
    case "TASK": return { type, title: "Gọi chăm sóc khách", dueDays: 1 };
    case "TAG": return { type, tag: "da-nhac-mua-lai" };
    default: return { type } as Step;
  }
}

function StepBody({ step, fields, onChange }: { step: Step; fields: SegmentField[]; onChange: (s: Step) => void }) {
  switch (step.type) {
    case "WAIT":
      return <label className="flex items-center gap-2 text-sm">Chờ <input aria-label="Số ngày chờ" type="number" min={0} max={365} className={cx(ctl, "w-20 tabular")} value={step.days} onChange={(e) => onChange({ ...step, days: Number(e.target.value) })} /> ngày rồi sang bước kế tiếp</label>;
    case "CONDITION":
      return (
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm">Tên điều kiện <input aria-label="Tên điều kiện" className={cx(ctl, "flex-1")} value={step.label} onChange={(e) => onChange({ ...step, label: e.target.value })} /></label>
          <p className="text-xs text-fg-muted">Khách không thỏa thì ra khỏi hành trình, lý do ghi theo tên điều kiện.</p>
          <RuleBuilder value={step.rules as never} fields={fields} onChange={(g) => onChange({ ...step, rules: g as never })} />
        </div>
      );
    case "STOCK_CHECK":
      return <p className="text-sm text-fg-muted">Kiểm tồn sản phẩm khách mua gần nhất (kho giả lập). Hết hàng thì khách ra khỏi hành trình, không gửi tin mời mua.</p>;
    case "SEND":
      return (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          Gửi qua
          <select aria-label="Kênh gửi" className={ctl} value={step.channel} onChange={(e) => onChange({ ...step, channel: e.target.value as typeof step.channel })}>
            {CHANNELS.map((c) => <option key={c} value={c}>{CHANNEL_LABEL[c]}</option>)}
          </select>
          mẫu
          <select aria-label="Mẫu tin" className={ctl} value={step.template} onChange={(e) => onChange({ ...step, template: e.target.value })}>
            {TEMPLATE_KEYS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <span className="w-full text-xs text-fg-muted">Ngôn ngữ theo khách. Chỉ gửi trong 9–20 giờ địa phương, cần đồng ý (EU), tối đa 2 tin/7 ngày mỗi kênh. Demo: ghi Outbox giả lập, không gửi thật.</span>
        </div>
      );
    case "TASK":
      return (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <input aria-label="Tiêu đề việc" className={cx(ctl, "min-w-72 flex-1")} value={step.title} onChange={(e) => onChange({ ...step, title: e.target.value })} />
          hạn sau <input aria-label="Số ngày tới hạn" type="number" min={0} max={60} className={cx(ctl, "w-16 tabular")} value={step.dueDays} onChange={(e) => onChange({ ...step, dueDays: Number(e.target.value) })} /> ngày
          <span className="w-full text-xs text-fg-muted">Giao cho người phụ trách nhu cầu mua gần nhất của khách; không có thì giao người tạo hành trình.</span>
        </div>
      );
    case "TAG":
      return <label className="flex items-center gap-2 text-sm">Gán thẻ <input aria-label="Thẻ" className={cx(ctl, "w-56")} value={step.tag} onChange={(e) => onChange({ ...step, tag: e.target.value })} /></label>;
    default:
      return <p className="text-sm text-fg-muted">Kết thúc hành trình tại đây.</p>;
  }
}

export function JourneyEditor({ initial, segments, brands, fields }: { initial: JourneyDraft; segments: { id: string; name: string; lastCount: number | null }[]; brands: { value: string; label: string }[]; fields: SegmentField[] }) {
  const [d, setD] = useState<JourneyDraft>(initial);
  const [add, setAdd] = useState<StepType>("SEND");
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(saveJourneyAction, null);
  const toast = useToast();
  useEffect(() => {
    if (state && !state.ok && state.message) toast(state.message, "danger");
  }, [state, toast]);

  const set = <K extends keyof JourneyDraft>(k: K, v: JourneyDraft[K]) => setD((x) => ({ ...x, [k]: v }));
  const setStep = (i: number, s: Step) => set("steps", d.steps.map((x, j) => (j === i ? s : x)));
  const move = (i: number, by: number) => {
    const s = [...d.steps];
    [s[i], s[i + by]] = [s[i + by], s[i]];
    set("steps", s);
  };
  const err = state?.fields ?? {};

  return (
    <form action={action} noValidate className="space-y-6">
      <input type="hidden" name="payload" value={JSON.stringify({ ...d, steps: d.steps })} />
      <FormError result={state} />
      <Card className="p-4">
        <div className="grid gap-x-4 md:grid-cols-2">
          <TextField label="Tên hành trình" name="name" required value={d.name} onChange={(e) => set("name", e.target.value)} error={err.name} />
          <Field label="Phân khúc vào" name="segmentId" required error={err.segmentId} hint="Khách trong ảnh chụp mới nhất của phân khúc được đưa vào khi hành trình đang chạy">
            <select id="segmentId" className={cx(ctl, "w-full")} value={d.segmentId} onChange={(e) => set("segmentId", e.target.value)}>
              <option value="">— Chọn phân khúc —</option>
              {segments.map((s) => <option key={s.id} value={s.id}>{s.name}{s.lastCount != null ? ` · ${s.lastCount.toLocaleString("vi-VN")} khách` : ""}</option>)}
            </select>
          </Field>
          <TextField label="Mô tả" name="description" value={d.description} onChange={(e) => set("description", e.target.value)} error={err.description} />
          <Field label="Brand gửi tin" name="brandId" hint="Tên brand trong tin và giới hạn tần suất theo brand">
            <select id="brandId" className={cx(ctl, "w-full")} value={d.brandId} onChange={(e) => set("brandId", e.target.value)}>
              <option value="">— Không —</option>
              {brands.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
            </select>
          </Field>
        </div>
      </Card>

      <Card>
        <SectionTitle>Luật thoát</SectionTitle>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 p-4 text-sm">
          {([["purchased", "Khách đã mua"], ["optOut", "Khách từ chối nhận tin"], ["openTicket", "Khách đang có khiếu nại"]] as const).map(([k, label]) => (
            <label key={k} className="flex items-center gap-2">
              <input type="checkbox" className="size-4 accent-[var(--color-brand)]" checked={d.exitRules[k]} onChange={(e) => set("exitRules", { ...d.exitRules, [k]: e.target.checked })} />
              {label}
            </label>
          ))}
          <label className="flex items-center gap-2">Hết hạn sau <input aria-label="Số ngày hết hạn" type="number" min={1} max={365} className={cx(ctl, "w-20 tabular")} value={d.exitRules.expireDays} onChange={(e) => set("exitRules", { ...d.exitRules, expireDays: Number(e.target.value) })} /> ngày</label>
          <label className="flex items-center gap-2">Cho vào lại sau <input aria-label="Số ngày cho vào lại" type="number" min={1} max={365} className={cx(ctl, "w-20 tabular")} value={d.reentryDays} onChange={(e) => set("reentryDays", Number(e.target.value))} /> ngày</label>
        </div>
      </Card>

      <Card>
        <SectionTitle actions={<span className="text-xs text-fg-muted">{d.steps.length}/20 bước</span>}>Các bước</SectionTitle>
        {err.steps && <p className="mx-4 mt-3 text-sm text-danger" role="alert">{err.steps}</p>}
        <ol className="space-y-3 p-4">
          {d.steps.map((s, i) => (
            <li key={i} className="rounded-[var(--radius-md)] border border-border">
              <div className="flex items-center gap-2 border-b border-border bg-bg-subtle px-3 py-2">
                <span className="tabular flex size-6 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand">{i + 1}</span>
                <span className="text-sm font-medium text-fg">{STEP_LABEL[s.type]}</span>
                <span className="ml-auto flex gap-1">
                  <Button type="button" size="sm" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Đưa bước ${i + 1} lên`}>↑</Button>
                  <Button type="button" size="sm" disabled={i === d.steps.length - 1} onClick={() => move(i, 1)} aria-label={`Đưa bước ${i + 1} xuống`}>↓</Button>
                  <Button type="button" size="sm" onClick={() => set("steps", d.steps.filter((_, j) => j !== i))} aria-label={`Xóa bước ${i + 1}`}>Xóa</Button>
                </span>
              </div>
              <div className="p-3"><StepBody step={s} fields={fields} onChange={(x) => setStep(i, x)} /></div>
            </li>
          ))}
          {d.steps.length === 0 && <li className="text-sm text-fg-muted">Chưa có bước nào. Thêm ít nhất một bước Gửi tin hoặc Tạo việc.</li>}
        </ol>
        <div className="flex items-center gap-2 border-t border-border px-4 py-3">
          <select aria-label="Loại bước" className={ctl} value={add} onChange={(e) => setAdd(e.target.value as StepType)}>
            {STEP_TYPES.map((t) => <option key={t} value={t}>{STEP_LABEL[t]}</option>)}
          </select>
          <Button type="button" disabled={d.steps.length >= 20} onClick={() => set("steps", [...d.steps, newStep(add, fields)])}>+ Thêm bước</Button>
        </div>
      </Card>

      <div className="flex justify-end gap-2">
        <ButtonLink href={d.id ? `/hanh-trinh/${d.id}` : "/hanh-trinh"}>Hủy</ButtonLink>
        <Button variant="primary" type="submit" disabled={pending}>{pending ? "Đang lưu…" : "Lưu hành trình"}</Button>
      </div>
    </form>
  );
}
