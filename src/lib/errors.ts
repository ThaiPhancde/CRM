import type { z } from "zod";
import { Prisma } from "@prisma/client";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Lỗi nghiệp vụ giữ nguyên, trùng khóa duy nhất → 409, còn lại → 500 (ghi log, không lộ chi tiết). */
/** Lỗi validate gom theo trường để form hiện inline. */
export class ValidationError extends HttpError {
  constructor(public fields: Record<string, string>) {
    super(400, "Dữ liệu chưa hợp lệ");
  }
}
export function parse<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const r = schema.safeParse(input);
  if (r.success) return r.data;
  const fields: Record<string, string> = {};
  for (const i of r.error.issues) fields[String(i.path[0] ?? "_")] ??= i.message;
  throw new ValidationError(fields);
}
export function toHttpError(e: unknown): HttpError {
  if (e instanceof HttpError) return e;
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return new HttpError(409, "Dữ liệu đã tồn tại");
  console.error(e);
  return new HttpError(500, "Lỗi máy chủ");
}

export function toResponse(e: unknown): Response {
  const err = toHttpError(e);
  return Response.json({ error: err.message }, { status: err.status });
}
