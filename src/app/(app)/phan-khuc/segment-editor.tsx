"use client";
// Drawer tạo/sửa phân khúc: tên + cây điều kiện + "Xem trước" (đếm khách, 20 khách mẫu, không ghi gì) + Lưu.
import { useActionState, useEffect, useState, useTransition } from "react";
import type { Group, SegmentField } from "@/modules/marketing/segments";
import { Field, FormError, TextField, type ActionResult } from "@/components/form";
import { Drawer, useToast } from "@/components/overlay";
import { Badge, Button } from "@/components/ui";
import { date, num } from "@/lib/format";
import { previewSegmentAction, saveSegmentAction } from "./actions";
import { emptyRule, RuleBuilder } from "./rule-builder";

type Initial = { id: string; name: string; description: string | null; rules: Group };
type Preview = Awaited<ReturnType<typeof previewSegmentAction>>;

export function SegmentEditor({ fields, initial, trigger = "Tạo phân khúc" }: { fields: SegmentField[]; initial?: Initial; trigger?: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [rules, setRules] = useState<Group>(initial?.rules ?? { op: "and", rules: [emptyRule(fields)] });
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewing, startPreview] = useTransition();
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(saveSegmentAction, null);
  const toast = useToast();

  useEffect(() => {
    if (!state) return;
    if (state.ok) { toast(state.message ?? "Đã lưu phân khúc.", "success"); setOpen(false); }
    else if (state.message) toast(state.message, "danger");
  }, [state, toast]);

  const changeRules = (g: Group) => { setRules(g); setPreview(null); };
  const runPreview = () => startPreview(async () => setPreview(await previewSegmentAction(JSON.stringify(rules))));

  return (
    <>
      <Button variant={initial ? "secondary" : "primary"} size={initial ? "sm" : "md"} aria-label={initial ? `${trigger} phân khúc ${initial.name}` : undefined} onClick={() => setOpen(true)}>{trigger}</Button>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        size="lg"
        title={initial ? `Sửa phân khúc "${initial.name}"` : "Tạo phân khúc"}
        description="Điều kiện chỉ dùng trường trong danh sách cho phép. Xem trước không ghi dữ liệu."
        footer={
          <>
            <Button onClick={() => setOpen(false)}>Hủy</Button>
            <Button type="button" onClick={runPreview} disabled={previewing}>{previewing ? "Đang đếm…" : "Xem trước"}</Button>
            <Button variant="primary" type="submit" form="segment-form" disabled={pending}>{pending ? "Đang lưu…" : "Lưu phân khúc"}</Button>
          </>
        }
      >
        <form id="segment-form" action={action} noValidate>
          <FormError result={state} />
          {initial && <input type="hidden" name="id" value={initial.id} />}
          <input type="hidden" name="rules" value={JSON.stringify(rules)} />
          <TextField label="Tên phân khúc" name="name" required value={name} onChange={(e) => setName(e.target.value)} error={state?.fields?.name} placeholder="Gần chu kỳ mua lại" />
          <TextField label="Mô tả" name="description" value={description} onChange={(e) => setDescription(e.target.value)} error={state?.fields?.description} />
          <Field label="Điều kiện" name="rules" required error={state?.fields?.rules}>
            <RuleBuilder value={rules} fields={fields} onChange={changeRules} />
          </Field>
        </form>

        <section aria-live="polite" className="mt-2">
          {!preview ? (
            <p className="text-xs text-fg-muted">Bấm &ldquo;Xem trước&rdquo; để đếm số khách thỏa điều kiện hiện tại.</p>
          ) : !preview.ok ? (
            <p className="rounded-[var(--radius-sm)] bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">{preview.message}</p>
          ) : (
            <div className="rounded-[var(--radius-md)] border border-border">
              <div className="flex items-center justify-between border-b border-border bg-bg-subtle px-3 py-2 text-sm">
                <span className="font-medium text-fg">{num(preview.count)} khách thỏa điều kiện</span>
                <Badge tone="info">Xem trước — chưa lưu</Badge>
              </div>
              {preview.count === 0 ? (
                <p className="px-3 py-3 text-sm text-fg-muted">Không có khách nào. Nới điều kiện rồi xem lại.</p>
              ) : (
                <table className="w-full text-sm">
                  <caption className="sr-only">20 khách mẫu trong phân khúc</caption>
                  <thead className="text-left text-xs text-fg-muted">
                    <tr><th scope="col" className="px-3 py-1.5">Khách</th><th scope="col" className="px-3 py-1.5">SĐT</th><th scope="col" className="px-3 py-1.5">Thị trường</th><th scope="col" className="px-3 py-1.5">Đặt gần nhất</th></tr>
                  </thead>
                  <tbody>
                    {preview.sample.map((c) => (
                      <tr key={c.id} className="border-t border-border">
                        <td className="px-3 py-1.5"><a className="text-fg hover:text-brand" href={`/khach-hang/${c.id}`} target="_blank" rel="noreferrer">{c.name}</a></td>
                        <td className="tabular px-3 py-1.5 text-fg-muted">{c.phone ?? "—"}</td>
                        <td className="px-3 py-1.5 text-fg-muted">{c.market ?? "—"}</td>
                        <td className="tabular px-3 py-1.5 text-fg-muted">{date(c.lastOrderAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </section>
      </Drawer>
    </>
  );
}
