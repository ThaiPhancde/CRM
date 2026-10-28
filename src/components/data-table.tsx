"use client";
// DataTable theo ui-design-system mục 5: header dính, tìm nhanh, sắp xếp cột, phân trang 25/50/100, trạng thái rỗng.
// ponytail: lọc/sắp/phân trang phía client trên dữ liệu đã tải — đủ cho danh mục và danh sách vài nghìn dòng;
// danh sách lớn (đơn, khách) chuyển sang phân trang phía server khi tới Phase 2–3.
import { useMemo, useState, type ReactNode } from "react";
import { cx, EmptyState } from "./ui";

export type Column<T> = {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** Giá trị dùng để sắp xếp + tìm kiếm; bỏ trống thì cột không sắp được. */
  sortValue?: (row: T) => string | number | null;
  align?: "left" | "right";
  className?: string;
};

export function DataTable<T>({
  rows, columns, rowKey, onRowClick, searchPlaceholder = "Tìm nhanh…", toolbar, empty, caption,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  searchPlaceholder?: string;
  toolbar?: ReactNode;
  empty?: ReactNode;
  caption: string;
}) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const [size, setSize] = useState(25);
  const [page, setPage] = useState(0);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let out = needle
      ? rows.filter((r) => columns.some((c) => String(c.sortValue?.(r) ?? "").toLowerCase().includes(needle)))
      : rows;
    const col = sort && columns.find((c) => c.key === sort.key);
    if (col?.sortValue) {
      const v = col.sortValue;
      out = [...out].sort((a, b) => {
        const x = v(a) ?? "", y = v(b) ?? "";
        return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "vi")) * sort!.dir;
      });
    }
    return out;
  }, [rows, columns, q, sort]);

  const pages = Math.max(1, Math.ceil(shown.length / size));
  const cur = Math.min(page, pages - 1);
  const slice = shown.slice(cur * size, cur * size + size);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <label className="relative">
          <span className="sr-only">Tìm kiếm</span>
          <svg aria-hidden className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-subtle" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="7" cy="7" r="5" /><path d="M11 11l3.5 3.5" strokeLinecap="round" /></svg>
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(0); }}
            placeholder={searchPlaceholder}
            className="h-8 w-64 rounded-[var(--radius-sm)] border border-border bg-bg pl-8 pr-3 text-sm placeholder:text-fg-subtle focus:border-brand-ring"
          />
        </label>
        <div className="ml-auto flex items-center gap-2">{toolbar}</div>
      </div>

      {rows.length === 0 ? (
        empty ?? <EmptyState title="Chưa có dữ liệu" />
      ) : shown.length === 0 ? (
        <EmptyState title="Không có kết quả phù hợp" description={`Không dòng nào khớp “${q}”.`} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">{caption}</caption>
            <thead className="sticky top-0 z-[var(--z-sticky)] bg-bg-subtle">
              <tr>
                {columns.map((c) => {
                  const active = sort?.key === c.key;
                  return (
                    <th key={c.key} scope="col" aria-sort={active ? (sort!.dir === 1 ? "ascending" : "descending") : undefined}
                      className={cx("h-10 border-b border-border px-4 text-xs font-medium text-fg-muted whitespace-nowrap", c.align === "right" ? "text-right" : "text-left")}>
                      {c.sortValue ? (
                        <button type="button" className={cx("inline-flex items-center gap-1 hover:text-fg", active && "text-fg")}
                          onClick={() => setSort(active ? (sort!.dir === 1 ? { key: c.key, dir: -1 } : null) : { key: c.key, dir: 1 })}>
                          {c.header}
                          <span aria-hidden className={cx("text-[10px]", !active && "opacity-30")}>{active && sort!.dir === -1 ? "▼" : "▲"}</span>
                        </button>
                      ) : c.header}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {slice.map((r) => (
                <tr key={rowKey(r)}
                  onClick={onRowClick ? () => onRowClick(r) : undefined}
                  onKeyDown={onRowClick ? (e) => e.key === "Enter" && onRowClick(r) : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  className={cx("h-11 border-b border-border last:border-0", onRowClick && "cursor-pointer hover:bg-bg-subtle")}>
                  {columns.map((c) => (
                    <td key={c.key} className={cx("px-4 py-2", c.align === "right" && "text-right tabular", c.className)}>{c.cell(r)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {shown.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-2.5 text-xs text-fg-muted">
          <span className="tabular">{cur * size + 1}–{Math.min(shown.length, cur * size + size)} / {shown.length} dòng</span>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5">
              Mỗi trang
              <select value={size} onChange={(e) => { setSize(Number(e.target.value)); setPage(0); }} className="h-7 rounded-[var(--radius-sm)] border border-border bg-bg px-1.5">
                {[25, 50, 100].map((n) => <option key={n}>{n}</option>)}
              </select>
            </label>
            <button type="button" disabled={cur === 0} onClick={() => setPage(cur - 1)} className="h-7 rounded-[var(--radius-sm)] border border-border px-2 disabled:opacity-40" aria-label="Trang trước">‹</button>
            <span className="tabular">{cur + 1}/{pages}</span>
            <button type="button" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)} className="h-7 rounded-[var(--radius-sm)] border border-border px-2 disabled:opacity-40" aria-label="Trang sau">›</button>
          </div>
        </div>
      )}
    </div>
  );
}
