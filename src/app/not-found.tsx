import { ButtonLink } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-bg-subtle px-4 text-center">
      <p className="text-5xl font-semibold text-brand">404</p>
      <h1 className="mt-2 text-lg font-semibold text-fg">Không tìm thấy trang</h1>
      <p className="mt-1 text-sm text-fg-muted">Trang không tồn tại hoặc bạn chưa có quyền xem.</p>
      <ButtonLink href="/" variant="primary" className="mt-5">Về Tổng quan</ButtonLink>
    </main>
  );
}
