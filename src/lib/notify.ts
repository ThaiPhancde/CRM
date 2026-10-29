// Thông báo trong ứng dụng + hàng đợi gửi ra ngoài (thiết kế mục 5 quy tắc 9, D-13).
// Cả hai idempotent theo khóa: worker chạy lại, bấm lại không sinh bản trùng (unique workspaceId + idempotencyKey).
import type { Db } from "./db";

type Client = Pick<Db, "notification" | "outbox">;

export async function notify(client: Client, n: { userId: string; title: string; body?: string; link?: string; key: string }) {
  const r = await client.notification.createMany({ data: [{ userId: n.userId, title: n.title, body: n.body, link: n.link, idempotencyKey: n.key }] as never, skipDuplicates: true });
  return r.count === 1;
}

/** Mọi gửi ra ngoài đi qua đây. EXTERNAL_WRITES_ENABLED khác "true" → SIMULATED, không bao giờ gửi. ponytail: chưa có adapter gửi thật (Phase 12). */
export async function enqueueOutbox(
  client: Client,
  m: { channel: string; recipient: string; subject?: string; body: string; entity?: string; entityId?: string; key: string },
) {
  const status = process.env.EXTERNAL_WRITES_ENABLED === "true" ? "PENDING" : "SIMULATED";
  const r = await client.outbox.createMany({
    data: [{ channel: m.channel, recipient: m.recipient, subject: m.subject, body: m.body, status, entity: m.entity, entityId: m.entityId, idempotencyKey: m.key }] as never,
    skipDuplicates: true,
  });
  return r.count === 1;
}
