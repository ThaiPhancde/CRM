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
