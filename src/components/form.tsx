// Ô form theo ui-design-system mục 5: nhãn trên ô, dấu * cam cho bắt buộc, lỗi inline đỏ dưới ô.
// Server-safe: không state; dùng trong form gửi server action.
import type { ComponentProps, ReactNode } from "react";
import { cx } from "./ui";

/** `values`: dữ liệu vừa gửi, để form hiện lại đúng cái người dùng nhập khi có lỗi (React 19 tự reset form sau action). */
export type ActionResult = { ok: boolean; message?: string; fields?: Record<string, string>; values?: Record<string, string | string[]> };

/** Giá trị mặc định cho ô: ưu tiên giá trị vừa gửi (khi lỗi), sau đó giá trị gốc. */
export function pick(result: ActionResult | null, original: Record<string, unknown> | null | undefined) {
  const sent = result && !result.ok ? result.values : undefined;
  return {
    str: (k: string) => (sent ? String(sent[k] ?? "") : String(original?.[k] ?? "")),
    list: (k: string) => (sent ? [sent[k] ?? []].flat() : ((original?.[k] as string[] | undefined) ?? [])),
    bool: (k: string, fallback = true) => (sent ? k in sent : original ? Boolean(original[k]) : fallback),
  };
}

const control = "h-9 w-full rounded-[var(--radius-sm)] border bg-bg px-3 text-sm text-fg placeholder:text-fg-subtle focus:border-brand-ring disabled:bg-bg-muted";

export function Field({ label, name, required, error, hint, children }: { label: string; name: string; required?: boolean; error?: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="mb-4">
      <label htmlFor={name} className="mb-1.5 block text-[13px] font-medium text-fg">
        {label}
        {required && <span className="ml-0.5 text-brand" aria-hidden>*</span>}
      </label>
      {children}
      {error ? (
        <p id={`${name}-error`} className="mt-1 text-xs text-danger" role="alert">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-fg-subtle">{hint}</p>
      ) : null}
    </div>
  );
}

type Base = { label: string; name: string; error?: string; hint?: ReactNode };

export function TextField({ label, name, error, hint, required, className, ...p }: Base & ComponentProps<"input">) {
  return (
    <Field label={label} name={name} required={required} error={error} hint={hint}>
      <input id={name} name={name} required={required} aria-invalid={!!error} aria-describedby={error ? `${name}-error` : undefined}
        className={cx(control, error ? "border-danger" : "border-border", className)} {...p} />
    </Field>
  );
}

export function SelectField({ label, name, error, hint, required, options, placeholder, ...p }: Base & ComponentProps<"select"> & { options: { value: string; label: string }[]; placeholder?: string }) {
  return (
    <Field label={label} name={name} required={required} error={error} hint={hint}>
      <select id={name} name={name} required={required} aria-invalid={!!error} className={cx(control, error ? "border-danger" : "border-border")} {...p}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </Field>
  );
}

export function CheckboxGroup({ label, name, error, required, options, defaultValue = [] }: Base & { required?: boolean; options: { value: string; label: string }[]; defaultValue?: string[] }) {
  return (
    <fieldset className="mb-4">
      <legend className="mb-1.5 text-[13px] font-medium text-fg">
        {label}
        {required && <span className="ml-0.5 text-brand" aria-hidden>*</span>}
      </legend>
      <div className={cx("grid grid-cols-2 gap-2 rounded-[var(--radius-sm)] border p-3", error ? "border-danger" : "border-border")}>
        {options.map((o) => (
          <label key={o.value} className="flex items-center gap-2 text-sm text-fg">
            <input type="checkbox" name={name} value={o.value} defaultChecked={defaultValue.includes(o.value)} className="size-4 accent-[var(--brand)]" />
            {o.label}
          </label>
        ))}
      </div>
      {error && <p className="mt-1 text-xs text-danger" role="alert">{error}</p>}
    </fieldset>
  );
}

export function Switch({ label, name, defaultChecked }: { label: string; name: string; defaultChecked?: boolean }) {
  return (
    <label className="mb-4 flex items-center gap-2 text-sm text-fg">
      <input type="checkbox" name={name} value="true" defaultChecked={defaultChecked} className="size-4 accent-[var(--brand)]" />
      {label}
    </label>
  );
}

export function FormError({ result }: { result: ActionResult | null }) {
  if (!result || result.ok || !result.message) return null;
  return <div role="alert" className="mb-4 rounded-[var(--radius-sm)] border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">{result.message}</div>;
}
