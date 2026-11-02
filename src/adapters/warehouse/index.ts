// Lớp phân tích (D-05): màn hình hằng ngày không chờ warehouse; chỉ số/điểm/báo cáo đi qua giao diện này.
// Cài đặt chọn bằng WAREHOUSE=postgres (mặc định, demo — chạy trên chính DB giao dịch) | bigquery (khung, Phase 12).
import { rootDb } from "@/lib/db";
import { HttpError } from "@/lib/errors";
import { customerMetricsInsert, dialect, revenueSummarySql, type Dialect } from "./sql";

export type RevenueRow = { key: string; value: number; customers: number; asOf: Date | null };

export interface Warehouse {
  readonly dialect: Dialect;
  /** Truy vấn đọc (báo cáo Phase 9). SQL viết bằng dialect(); tham số dạng @ten. */
  query<T = Record<string, unknown>>(sql: string, params: Record<string, unknown>): Promise<T[]>;
  /** Dựng lại CustomerMetric kỳ R12M tới asOf cho một team. */
  refreshCustomerMetrics(workspaceId: string, asOf: Date): Promise<{ customers: number; ms: number }>;
  /** Mốc dữ liệu chỉ số mới nhất của team (null = chưa dựng). */
  freshness(workspaceId: string): Promise<Date | null>;
  /** Tổng REV-0x kỳ R12M theo thị trường / cả team — chỉ đọc, giới hạn thời gian + số dòng (tool AI hoi_bao_cao). */
  revenueSummary(workspaceId: string, metric: "rev01" | "rev02" | "rev03" | "rev04", groupBy: "market" | "none"): Promise<RevenueRow[]>;
}

class PostgresWarehouse implements Warehouse {
  readonly dialect = dialect("postgres");
  async query<T>(sql: string, params: Record<string, unknown>) {
    const b = this.dialect.bind(sql, params);
    return rootDb.$queryRawUnsafe<T[]>(b.sql, ...b.values);
  }
  async refreshCustomerMetrics(workspaceId: string, asOf: Date) {
    const t = Date.now();
    const ins = this.dialect.bind(customerMetricsInsert(this.dialect), { ws: workspaceId, asOf });
    const customers = await rootDb.$transaction(async (tx) => {
      // Truy vấn phân tích gộp hàng triệu dòng: cho phép sắp xếp/gộp trong bộ nhớ (mặc định 4MB → tràn đĩa). Chỉ trong giao dịch này.
      await tx.$executeRawUnsafe("SET LOCAL work_mem = '128MB'");
      await tx.customerMetric.deleteMany({ where: { workspaceId, period: "R12M" } });
      return tx.$executeRawUnsafe(ins.sql, ...ins.values);
    }, { timeout: 300_000 });
    return { customers, ms: Date.now() - t };
  }
  async freshness(workspaceId: string) {
    const r = await rootDb.customerMetric.findFirst({ where: { workspaceId, period: "R12M" }, select: { asOf: true } });
    return r?.asOf ?? null;
  }
  async revenueSummary(workspaceId: string, metric: "rev01" | "rev02" | "rev03" | "rev04", groupBy: "market" | "none") {
    const b = this.dialect.bind(revenueSummarySql(this.dialect, metric, groupBy), { ws: workspaceId });
    // Tương đương "tài khoản chỉ đọc" ở demo: giao dịch read-only + giới hạn 10 s (BigQuery thật: service account chỉ đọc + maximumBytesBilled).
    const rows = await rootDb.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
      await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '10s'");
      return tx.$queryRawUnsafe<{ key: string; value: unknown; customers: unknown; asOf: Date | null }[]>(b.sql, ...b.values);
    });
    return rows.map((r) => ({ key: r.key, value: Number(r.value ?? 0), customers: Number(r.customers), asOf: r.asOf }));
  }
}

/**
 * Khung BigQuery (Phase 12): cần GOOGLE_APPLICATION_CREDENTIALS + BIGQUERY_DATASET và cài @google-cloud/bigquery.
 * Chưa xác minh dataset của công ty (D-M2) — không bịa; mọi lời gọi trả 501 có hướng dẫn.
 */
class BigQueryWarehouse implements Warehouse {
  readonly dialect = dialect("bigquery", process.env.BIGQUERY_DATASET || "crm");
  private notReady(): never {
    throw new HttpError(501, "BigQuery chưa bật: cần GOOGLE_APPLICATION_CREDENTIALS, BIGQUERY_DATASET và gói @google-cloud/bigquery (Phase 12). Dùng WAREHOUSE=postgres cho demo.");
  }
  async query<T>(): Promise<T[]> { return this.notReady(); }
  async refreshCustomerMetrics(): Promise<{ customers: number; ms: number }> { return this.notReady(); }
  async freshness(): Promise<Date | null> { return this.notReady(); }
  async revenueSummary(): Promise<RevenueRow[]> { return this.notReady(); }
}

export const warehouseFor = (name: "postgres" | "bigquery"): Warehouse => (name === "bigquery" ? new BigQueryWarehouse() : new PostgresWarehouse());

let cached: Warehouse | null = null;
export function getWarehouse(): Warehouse {
  if (!cached) cached = warehouseFor(process.env.WAREHOUSE === "bigquery" ? "bigquery" : "postgres");
  return cached;
}
