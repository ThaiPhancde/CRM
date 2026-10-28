// Chống ghi trùng (D-16): hành động lặp lại cùng (scope, key) trong một workspace chỉ chạy một lần.
// Dựa vào unique (workspaceId, scope, key) của DB, không vào kiểm tra trước rồi ghi (tránh đua).
import { Prisma } from "@prisma/client";
import { db } from "./db";

/** Chạy `fn` nếu (scope, key) chưa dùng; đã dùng → trả resultRef đã lưu, không chạy lại. */
export async function once(scope: string, key: string, fn: () => Promise<string>): Promise<{ ref: string | null; replayed: boolean }> {
  try {
    await db.idempotencyKey.create({ data: { scope, key } as Prisma.IdempotencyKeyUncheckedCreateInput });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const prev = await db.idempotencyKey.findFirst({ where: { scope, key } });
      return { ref: prev?.resultRef ?? null, replayed: true };
    }
    throw e;
  }
  try {
    const ref = await fn();
    await db.idempotencyKey.updateMany({ where: { scope, key }, data: { resultRef: ref } });
    return { ref, replayed: false };
  } catch (e) {
    // Thất bại thì nhả khóa để thử lại được.
    await db.idempotencyKey.deleteMany({ where: { scope, key } });
    throw e;
  }
}
