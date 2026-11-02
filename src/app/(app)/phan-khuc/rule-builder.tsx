"use client";
// Trình dựng điều kiện phân khúc: nhóm VÀ/HOẶC, mỗi dòng = trường (danh sách cho phép từ server) + phép so sánh + giá trị.
// Giao diện cho lồng 2 cấp (server cho tối đa 3). Dùng chung cho bước "Điều kiện" của hành trình.
import type { Group, Rule, SegmentField } from "@/modules/marketing/segments";
import { CMP_LABEL, CMPS_BY_TYPE } from "@/modules/marketing/labels";
import { Button, cx } from "@/components/ui";

const ctl = "h-9 rounded-[var(--radius-sm)] border border-border bg-bg px-2 text-sm text-fg focus:border-brand-ring";

export const emptyRule = (fields: SegmentField[]): Rule => {
  const f = fields[0];
  return { field: f.key, cmp: CMPS_BY_TYPE[f.type][0] as Rule["cmp"], value: defaultValue(f) };
};
function defaultValue(f: SegmentField): unknown {
  if (f.type === "number") return 0;
  if (f.type === "bool") return true;
  return f.options?.[0]?.value ?? "";
}

function RuleRow({ rule, fields, onChange, onRemove }: { rule: Rule; fields: SegmentField[]; onChange: (r: Rule) => void; onRemove: () => void }) {
  const f = fields.find((x) => x.key === rule.field);
  const cmps = f ? CMPS_BY_TYPE[f.type] : [];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select aria-label="Trường" className={cx(ctl, "min-w-56")} value={rule.field} onChange={(e) => {
        const nf = fields.find((x) => x.key === e.target.value)!;
        onChange({ field: nf.key, cmp: CMPS_BY_TYPE[nf.type][0] as Rule["cmp"], value: defaultValue(nf) });
      }}>
        {!f && <option value={rule.field}>{rule.field} (không còn dùng được)</option>}
        {fields.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
      </select>
      <select aria-label="Phép so sánh" className={ctl} value={rule.cmp} onChange={(e) => {
        const cmp = e.target.value as Rule["cmp"];
        // "thuộc" giữ danh sách; đổi sang phép một giá trị thì lấy phần tử đầu.
        const value = cmp === "in" ? [rule.value].flat().filter((x) => x !== "") : Array.isArray(rule.value) ? (rule.value[0] ?? "") : rule.value;
        onChange({ ...rule, cmp, value });
      }}>
        {cmps.map((c) => <option key={c} value={c}>{CMP_LABEL[c]}</option>)}
      </select>
      {f?.type === "number" ? (
        <span className="flex items-center gap-1">
          <input aria-label="Giá trị" type="number" step="any" className={cx(ctl, "w-28 tabular")} value={String(rule.value ?? "")} onChange={(e) => onChange({ ...rule, value: e.target.value === "" ? "" : Number(e.target.value) })} />
          {f.unit && <span className="text-xs text-fg-muted">{f.unit}</span>}
        </span>
      ) : f?.type === "bool" ? (
        <select aria-label="Giá trị" className={ctl} value={String(rule.value)} onChange={(e) => onChange({ ...rule, value: e.target.value === "true" })}>
          <option value="true">Có</option>
          <option value="false">Không</option>
        </select>
      ) : f?.type === "tags" ? (
        <>
          <input aria-label="Thẻ" list={`tags-${f.key}`} className={cx(ctl, "w-40")} value={String(rule.value ?? "")} onChange={(e) => onChange({ ...rule, value: e.target.value })} />
          <datalist id={`tags-${f.key}`}>{f.options?.map((o) => <option key={o.value} value={o.value} />)}</datalist>
        </>
      ) : rule.cmp === "in" ? (
        <fieldset className="flex flex-wrap gap-x-3 gap-y-1">
          <legend className="sr-only">Giá trị (chọn nhiều)</legend>
          {f?.options?.map((o) => {
            const list = [rule.value].flat().map(String);
            return (
              <label key={o.value} className="flex items-center gap-1.5 text-sm">
                <input type="checkbox" className="size-4 accent-[var(--color-brand)]" checked={list.includes(o.value)}
                  onChange={(e) => onChange({ ...rule, value: e.target.checked ? [...list, o.value] : list.filter((x) => x !== o.value) })} />
                {o.label}
              </label>
            );
          })}
        </fieldset>
      ) : (
        <select aria-label="Giá trị" className={cx(ctl, "min-w-40")} value={String(rule.value ?? "")} onChange={(e) => onChange({ ...rule, value: e.target.value })}>
          {f?.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )}
      <button type="button" onClick={onRemove} className="ml-auto rounded px-2 text-sm text-fg-muted hover:text-danger" aria-label="Xóa điều kiện">✕</button>
    </div>
  );
}

export function RuleBuilder({ value, fields, onChange, depth = 0, onRemove }: { value: Group; fields: SegmentField[]; onChange: (g: Group) => void; depth?: number; onRemove?: () => void }) {
  const set = (i: number, r: Rule | Group) => onChange({ ...value, rules: value.rules.map((x, j) => (j === i ? r : x)) });
  const remove = (i: number) => onChange({ ...value, rules: value.rules.filter((_, j) => j !== i) });
  return (
    <div className={cx("space-y-2 rounded-[var(--radius-md)] border p-3", depth ? "border-dashed border-border bg-bg-subtle" : "border-border")}>
      <div className="flex items-center gap-2 text-sm">
        <span className="text-fg-muted">Khách thỏa</span>
        <select aria-label="Cách kết hợp" className={ctl} value={value.op} onChange={(e) => onChange({ ...value, op: e.target.value as Group["op"] })}>
          <option value="and">tất cả điều kiện</option>
          <option value="or">một trong các điều kiện</option>
        </select>
        {onRemove && <button type="button" onClick={onRemove} className="ml-auto text-xs text-fg-muted hover:text-danger">Xóa nhóm</button>}
      </div>
      {value.rules.length === 0 && <p className="text-xs text-warning">Nhóm chưa có điều kiện nào.</p>}
      {value.rules.map((r, i) =>
        "op" in r ? (
          <RuleBuilder key={i} value={r} fields={fields} depth={depth + 1} onChange={(g) => set(i, g)} onRemove={() => remove(i)} />
        ) : (
          <RuleRow key={i} rule={r} fields={fields} onChange={(x) => set(i, x)} onRemove={() => remove(i)} />
        ),
      )}
      <div className="flex gap-2 pt-1">
        <Button type="button" size="sm" onClick={() => onChange({ ...value, rules: [...value.rules, emptyRule(fields)] })}>+ Điều kiện</Button>
        {depth === 0 && (
          <Button type="button" size="sm" onClick={() => onChange({ ...value, rules: [...value.rules, { op: value.op === "and" ? "or" : "and", rules: [emptyRule(fields)] }] })}>
            + Nhóm {value.op === "and" ? "HOẶC" : "VÀ"}
          </Button>
        )}
      </div>
    </div>
  );
}
