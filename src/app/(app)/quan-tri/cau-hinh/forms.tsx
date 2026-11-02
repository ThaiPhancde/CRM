"use client";

import { useActionState, useEffect } from "react";
import { FormError, pick, type ActionResult } from "@/components/form";
import { useToast } from "@/components/overlay";
import { Badge, Button, cx } from "@/components/ui";
import {
  saveCapAction,
  saveHoursAction,
  saveLowStockAction,
  saveRoutingAction,
  saveSlaAction,
} from "./actions";

const inputClass =
  "tabular h-8 rounded-[var(--radius-sm)] border bg-bg px-2.5 text-sm text-fg placeholder:text-fg-subtle focus:border-brand-ring";

function useActionToast(state: ActionResult | null) {
  const toast = useToast();
  useEffect(() => {
    if (state?.message) {
      toast(state.message, state.ok ? "success" : "danger");
    }
  }, [state, toast]);
}

export function SlaForm({
  brandId,
  priority,
  firstResponseHours,
  resolveHours,
}: {
  brandId: string | null;
  priority: string;
  firstResponseHours: number | null;
  resolveHours: number | null;
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(saveSlaAction, null);
  useActionToast(state);

  const d = pick(state, {
    firstResponseHours: firstResponseHours ?? "",
    resolveHours: resolveHours ?? "",
  });
  const v = d.str;
  const f = state?.fields ?? {};
  const rowKey = `${brandId ?? "all"}-${priority}`;
  const firstId = `sla-first-${rowKey}`;
  const resolveId = `sla-resolve-${rowKey}`;

  return (
    <form action={action} className="space-y-1">
      <input type="hidden" name="brandId" value={brandId ?? ""} />
      <input type="hidden" name="priority" value={priority} />
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5">
          <label htmlFor={firstId} className="text-xs text-fg-muted">
            Phản hồi (giờ)
          </label>
          <input
            id={firstId}
            name="firstResponseHours"
            type="number"
            step="0.5"
            min={0.5}
            max={720}
            required
            defaultValue={v("firstResponseHours")}
            placeholder="Giờ"
            className={cx(inputClass, "w-24", f.firstResponseHours ? "border-danger" : "border-border")}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <label htmlFor={resolveId} className="text-xs text-fg-muted">
            Xử lý (giờ)
          </label>
          <input
            id={resolveId}
            name="resolveHours"
            type="number"
            step="0.5"
            min={0.5}
            max={720}
            required
            defaultValue={v("resolveHours")}
            placeholder="Giờ"
            className={cx(inputClass, "w-24", f.resolveHours ? "border-danger" : "border-border")}
          />
        </div>
        <Button
          type="submit"
          variant="primary"
          size="sm"
          disabled={pending}
          aria-label={`Lưu ngưỡng SLA ${brandId ?? "mọi thương hiệu"} mức ${priority}`}
        >
          {pending ? "Đang lưu…" : "Lưu"}
        </Button>
      </div>
      {(f.firstResponseHours || f.resolveHours || f.brandId || f.priority) && (
        <p className="text-xs text-danger" role="alert">
          {f.firstResponseHours ?? f.resolveHours ?? f.brandId ?? f.priority}
        </p>
      )}
    </form>
  );
}

export function RoutingForm({
  firstResponseHours,
  maxOpenPerUser,
  autoCloseDays,
  dedupeDays,
}: {
  firstResponseHours: number;
  maxOpenPerUser: number;
  autoCloseDays: number;
  dedupeDays: number;
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(saveRoutingAction, null);
  useActionToast(state);

  const d = pick(state, {
    firstResponseHours,
    maxOpenPerUser,
    autoCloseDays,
    dedupeDays,
  });
  const v = d.str;
  const f = state?.fields ?? {};

  return (
    <form action={action} className="space-y-3">
      <FormError result={state} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label htmlFor="routing-firstResponseHours" className="mb-1 block text-xs font-medium text-fg">
            Giờ phản hồi đầu
          </label>
          <input
            id="routing-firstResponseHours"
            name="firstResponseHours"
            type="number"
            step="0.5"
            min={0.5}
            max={720}
            required
            defaultValue={v("firstResponseHours")}
            className={cx(inputClass, "w-full", f.firstResponseHours ? "border-danger" : "border-border")}
          />
          {f.firstResponseHours && (
            <p className="mt-1 text-xs text-danger" role="alert">
              {f.firstResponseHours}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="routing-maxOpenPerUser" className="mb-1 block text-xs font-medium text-fg">
            Nhu cầu mua mở tối đa / Sales
          </label>
          <input
            id="routing-maxOpenPerUser"
            name="maxOpenPerUser"
            type="number"
            step={1}
            min={1}
            max={500}
            required
            defaultValue={v("maxOpenPerUser")}
            className={cx(inputClass, "w-full", f.maxOpenPerUser ? "border-danger" : "border-border")}
          />
          {f.maxOpenPerUser && (
            <p className="mt-1 text-xs text-danger" role="alert">
              {f.maxOpenPerUser}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="routing-autoCloseDays" className="mb-1 block text-xs font-medium text-fg">
            Tự đóng sau N ngày không tương tác (0 = tắt)
          </label>
          <input
            id="routing-autoCloseDays"
            name="autoCloseDays"
            type="number"
            step={1}
            min={0}
            max={365}
            required
            defaultValue={v("autoCloseDays")}
            className={cx(inputClass, "w-full", f.autoCloseDays ? "border-danger" : "border-border")}
          />
          {f.autoCloseDays && (
            <p className="mt-1 text-xs text-danger" role="alert">
              {f.autoCloseDays}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="routing-dedupeDays" className="mb-1 block text-xs font-medium text-fg">
            Gộp liên hệ lại trong N ngày
          </label>
          <input
            id="routing-dedupeDays"
            name="dedupeDays"
            type="number"
            step={1}
            min={0}
            max={90}
            required
            defaultValue={v("dedupeDays")}
            className={cx(inputClass, "w-full", f.dedupeDays ? "border-danger" : "border-border")}
          />
          {f.dedupeDays && (
            <p className="mt-1 text-xs text-danger" role="alert">
              {f.dedupeDays}
            </p>
          )}
        </div>
      </div>
      <div>
        <Button type="submit" variant="primary" size="sm" disabled={pending} aria-label="Lưu cấu hình phân công nhu cầu mua">
          {pending ? "Đang lưu…" : "Lưu"}
        </Button>
      </div>
    </form>
  );
}

export function CapForm({
  channel,
  channelLabel,
  maxCount,
  windowDays,
  custom,
}: {
  channel: string;
  channelLabel: string;
  maxCount: number;
  windowDays: number;
  custom: boolean;
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(saveCapAction, null);
  useActionToast(state);

  const d = pick(state, { maxCount, windowDays });
  const v = d.str;
  const f = state?.fields ?? {};
  const maxId = `cap-max-${channel}`;
  const winId = `cap-window-${channel}`;

  return (
    <form action={action} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
      <input type="hidden" name="channel" value={channel} />
      <div className="min-w-48">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-fg">{channelLabel}</span>
          {custom ? (
            <Badge tone="brand">Tùy chỉnh</Badge>
          ) : (
            <span className="text-xs text-fg-muted">Mặc định</span>
          )}
        </div>
        <p className="tabular text-xs text-fg-muted">
          {maxCount} tin / {windowDays} ngày mỗi khách
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5">
          <label htmlFor={maxId} className="text-xs text-fg-muted">
            Số tin tối đa
          </label>
          <input
            id={maxId}
            name="maxCount"
            type="number"
            step={1}
            min={0}
            max={50}
            required
            defaultValue={v("maxCount")}
            className={cx(inputClass, "w-20", f.maxCount ? "border-danger" : "border-border")}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <label htmlFor={winId} className="text-xs text-fg-muted">
            Số ngày
          </label>
          <input
            id={winId}
            name="windowDays"
            type="number"
            step={1}
            min={1}
            max={90}
            required
            defaultValue={v("windowDays")}
            className={cx(inputClass, "w-20", f.windowDays ? "border-danger" : "border-border")}
          />
        </div>
        <Button type="submit" variant="primary" size="sm" disabled={pending} aria-label={`Lưu giới hạn liên hệ ${channelLabel}`}>
          {pending ? "Đang lưu…" : "Lưu"}
        </Button>
      </div>

      {(f.maxCount || f.windowDays || f.channel) && (
        <p className="w-full text-xs text-danger" role="alert">
          {f.maxCount ?? f.windowDays ?? f.channel}
        </p>
      )}
    </form>
  );
}

export function HoursForm({
  market,
  label,
  from,
  to,
  defaultFrom,
  defaultTo,
}: {
  market: string;
  label: string;
  from: number | null;
  to: number | null;
  defaultFrom: number;
  defaultTo: number;
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(saveHoursAction, null);
  useActionToast(state);

  const d = pick(state, {
    from: from ?? "",
    to: to ?? "",
  });
  const v = d.str;
  const f = state?.fields ?? {};
  const key = market === "*" ? "default" : market;
  const fromId = `hours-from-${key}`;
  const toId = `hours-to-${key}`;

  return (
    <form action={action} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
      <input type="hidden" name="market" value={market} />
      <div className="min-w-60">
        <p className="text-sm font-medium text-fg">{label}</p>
        <p className="tabular text-xs text-fg-muted">
          {market === "*"
            ? `Khung mặc định: ${from ?? defaultFrom}–${to ?? defaultTo} giờ`
            : from == null || to == null
              ? `dùng mặc định ${defaultFrom}–${defaultTo} giờ`
              : `Khung riêng: ${from}–${to} giờ`}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5">
          <label htmlFor={fromId} className="text-xs text-fg-muted">
            Từ giờ
          </label>
          <input
            id={fromId}
            name="from"
            type="number"
            step={1}
            min={0}
            max={24}
            defaultValue={v("from")}
            placeholder={market === "*" ? undefined : String(defaultFrom)}
            className={cx(inputClass, "w-20", f.from ? "border-danger" : "border-border")}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <label htmlFor={toId} className="text-xs text-fg-muted">
            Đến giờ
          </label>
          <input
            id={toId}
            name="to"
            type="number"
            step={1}
            min={0}
            max={24}
            defaultValue={v("to")}
            placeholder={market === "*" ? undefined : String(defaultTo)}
            className={cx(inputClass, "w-20", f.to ? "border-danger" : "border-border")}
          />
        </div>
        <Button type="submit" variant="primary" size="sm" disabled={pending} aria-label={`Lưu giờ làm việc ${label}`}>
          {pending ? "Đang lưu…" : "Lưu"}
        </Button>
      </div>

      {(f.from || f.to || f.market) && (
        <p className="w-full text-xs text-danger" role="alert">
          {f.from ?? f.to ?? f.market}
        </p>
      )}
    </form>
  );
}

export function LowStockForm({
  market,
  label,
  value,
  defaultValue,
}: {
  market: string;
  label: string;
  value: number | null;
  defaultValue: number;
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(saveLowStockAction, null);
  useActionToast(state);

  const d = pick(state, { value: value ?? "" });
  const v = d.str;
  const f = state?.fields ?? {};
  const key = market === "*" ? "default" : market;
  const valId = `lowstock-value-${key}`;

  return (
    <form action={action} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
      <input type="hidden" name="market" value={market} />
      <div className="min-w-52">
        <p className="text-sm font-medium text-fg">{label}</p>
        <p className="tabular text-xs text-fg-muted">
          {market === "*"
            ? `Mặc định: ${value ?? defaultValue} đơn vị`
            : value == null
              ? `dùng mặc định (${defaultValue} đơn vị)`
              : `Ngưỡng riêng: ${value} đơn vị`}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5">
          <label htmlFor={valId} className="text-xs text-fg-muted">
            Ngưỡng tồn
          </label>
          <input
            id={valId}
            name="value"
            type="number"
            step={1}
            min={0}
            max={100000}
            defaultValue={v("value")}
            placeholder={market === "*" ? undefined : String(defaultValue)}
            className={cx(inputClass, "w-28", f.value ? "border-danger" : "border-border")}
          />
        </div>
        <Button type="submit" variant="primary" size="sm" disabled={pending} aria-label={`Lưu ngưỡng tồn thấp ${label}`}>
          {pending ? "Đang lưu…" : "Lưu"}
        </Button>
      </div>

      {(f.value || f.market) && (
        <p className="w-full text-xs text-danger" role="alert">
          {f.value ?? f.market}
        </p>
      )}
    </form>
  );
}
