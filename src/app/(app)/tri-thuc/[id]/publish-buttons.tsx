"use client";
// Cụm nút thao tác bài tri thức: Sửa (tạo phiên bản mới), Xuất bản phiên bản đang xem, Lưu trữ (có hộp thoại xác nhận).
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import type { ActionResult } from "@/components/form";
import { Modal, useToast } from "@/components/overlay";
import { Button, ButtonLink } from "@/components/ui";
import { setArticleStatusAction } from "../actions";

export function PublishButtons({
  articleId,
  viewingVersion,
  publishedVersion,
  status,
  canEdit,
  canPublish,
}: {
  articleId: string;
  viewingVersion: number;
  publishedVersion: number | null;
  status: string;
  canEdit: boolean;
  canPublish: boolean;
}) {
  const [publishState, publishAction, publishPending] = useActionState<ActionResult | null, FormData>(
    setArticleStatusAction,
    null,
  );
  const [archiveState, archiveAction, archivePending] = useActionState<ActionResult | null, FormData>(
    setArticleStatusAction,
    null,
  );
  const [confirmArchive, setConfirmArchive] = useState(false);
  const toast = useToast();
  const router = useRouter();

  useEffect(() => {
    if (!publishState) return;
    toast(
      publishState.message ?? (publishState.ok ? "Đã xuất bản phiên bản này." : "Không thể xuất bản."),
      publishState.ok ? "success" : "danger",
    );
    if (publishState.ok) {
      router.refresh();
    }
  }, [publishState, toast, router]);

  useEffect(() => {
    if (!archiveState) return;
    toast(
      archiveState.message ?? (archiveState.ok ? "Đã lưu trữ bài viết." : "Không thể lưu trữ."),
      archiveState.ok ? "success" : "danger",
    );
    if (archiveState.ok) {
      setConfirmArchive(false);
      router.refresh();
    }
  }, [archiveState, toast, router]);

  if (!canEdit) return null;

  const showPublishButton =
    canPublish && (viewingVersion !== publishedVersion || status !== "PUBLISHED");

  return (
    <div className="space-y-2">
      {showPublishButton && (
        <form action={publishAction}>
          <input type="hidden" name="id" value={articleId} />
          <input type="hidden" name="status" value="PUBLISHED" />
          <input type="hidden" name="version" value={String(viewingVersion)} />
          <Button type="submit" variant="primary" className="w-full" disabled={publishPending}>
            {publishPending ? "Đang xuất bản…" : "Xuất bản phiên bản này"}
          </Button>
        </form>
      )}

      <ButtonLink
        href={`?v=${viewingVersion}&edit=1`}
        variant={showPublishButton ? "secondary" : "primary"}
        className="w-full"
      >
        Sửa (tạo phiên bản mới)
      </ButtonLink>

      {status !== "ARCHIVED" && (
        <Button
          variant="danger"
          className="w-full"
          onClick={() => setConfirmArchive(true)}
          disabled={archivePending}
        >
          Lưu trữ
        </Button>
      )}

      <Modal
        open={confirmArchive}
        onClose={() => setConfirmArchive(false)}
        title="Lưu trữ bài tri thức"
        description="Khi lưu trữ, bài hướng dẫn này sẽ ẩn khỏi danh sách tra cứu của nhân viên chăm sóc khách hàng. Bạn vẫn có thể sửa để tạo bản nháp mới sau này."
        footer={
          <>
            <Button onClick={() => setConfirmArchive(false)}>Hủy</Button>
            <form action={archiveAction}>
              <input type="hidden" name="id" value={articleId} />
              <input type="hidden" name="status" value="ARCHIVED" />
              <Button type="submit" variant="danger" disabled={archivePending}>
                {archivePending ? "Đang lưu trữ…" : "Xác nhận lưu trữ"}
              </Button>
            </form>
          </>
        }
      >
        <p className="text-sm text-fg">
          Bạn có chắc chắn muốn chuyển bài tri thức này sang trạng thái <strong>Lưu trữ</strong>?
        </p>
      </Modal>
    </div>
  );
}
