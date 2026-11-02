"use client";
// Biểu đồ báo cáo (Recharts) — nhận ĐÚNG mảng dữ liệu của bảng bên dưới nên biểu đồ và bảng luôn cùng số.
// Không hiệu ứng vẽ (báo cáo đọc số, tôn trọng người nhạy chuyển động). Quy ước dataviz: một trục y; màu theo thứ tự cố định (--chart-1..5), không xoay vòng; ≥ 2 chuỗi thì có chú giải; nét mảnh, cột bo 4px.
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type Series = { key: string; label: string };
type Fmt = "money" | "number" | "pct";

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

function formatter(fmt: Fmt, currency: string) {
  const nf = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: fmt === "pct" ? 1 : currency === "VND" ? 0 : 2 });
  const compact = new Intl.NumberFormat("vi-VN", { notation: "compact", maximumFractionDigits: 1 });
  return {
    full: (v: unknown) => (v == null ? "—" : fmt === "pct" ? `${nf.format(Number(v))}%` : fmt === "money" ? `${nf.format(Number(v))} ${currency}` : nf.format(Number(v))),
    axis: (v: number) => (fmt === "pct" ? `${v}%` : compact.format(v)),
  };
}

export function ReportChart({ kind = "bar", data, x, series, fmt = "number", currency = "VND", height = 280, caption }: {
  kind?: "bar" | "line" | "stacked"; data: Record<string, unknown>[]; x: string; series: Series[]; fmt?: Fmt; currency?: string; height?: number; caption: string;
}) {
  if (!data.length) return null;
  const f = formatter(fmt, currency);
  // ponytail: tối đa 5 chuỗi (đủ màu đã kiểm định); nhiều hơn thì gom "Khác" ở phía service trước khi vẽ.
  const ss = series.slice(0, COLORS.length);
  const common = (
    <>
      <CartesianGrid vertical={false} stroke="var(--border)" />
      <XAxis dataKey={x} tick={{ fontSize: 12, fill: "var(--fg-muted)" }} tickLine={false} axisLine={{ stroke: "var(--border-strong)" }} interval="preserveStartEnd" />
      <YAxis tickFormatter={f.axis} tick={{ fontSize: 12, fill: "var(--fg-muted)" }} tickLine={false} axisLine={false} width={64} />
      <Tooltip formatter={(v) => f.full(v)} contentStyle={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12, color: "var(--fg)" }} cursor={{ fill: "var(--bg-muted)" }} />
      {ss.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} formatter={(v) => <span style={{ color: "var(--fg-muted)" }}>{v}</span>} />}
    </>
  );
  return (
    <figure className="px-2 py-3" aria-label={caption}>
      <figcaption className="sr-only">{caption} — số liệu đầy đủ ở bảng bên dưới.</figcaption>
      <ResponsiveContainer width="100%" height={height}>
        {kind === "line" ? (
          <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            {common}
            {ss.map((s, i) => <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={COLORS[i]} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: "var(--bg)" }} activeDot={{ r: 5 }} isAnimationActive={false} />)}
          </LineChart>
        ) : (
          <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }} barGap={2}>
            {common}
            {ss.map((s, i) => <Bar key={s.key} dataKey={s.key} name={s.label} fill={COLORS[i]} stackId={kind === "stacked" ? "s" : undefined} radius={kind === "stacked" && i < ss.length - 1 ? 0 : [4, 4, 0, 0]} maxBarSize={48} stroke="var(--bg)" strokeWidth={kind === "stacked" ? 2 : 0} isAnimationActive={false} />)}
          </BarChart>
        )}
      </ResponsiveContainer>
    </figure>
  );
}
