"use client";
import { Button, Card } from "@/components/ui";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <Card className="mx-auto mt-10 max-w-lg p-8 text-center">
      <div aria-hidden className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-danger-soft text-xl text-danger">!</div>
      <h1 className="text-lg font-semibold text-fg">Không tải được trang</h1>
      <p className="mt-1 text-sm text-fg-muted">Đã có lỗi ở máy chủ. Bạn thử lại; nếu vẫn lỗi, báo quản trị kèm thời điểm xảy ra.</p>
      <Button variant="primary" className="mt-5" onClick={reset}>Thử lại</Button>
    </Card>
  );
}
