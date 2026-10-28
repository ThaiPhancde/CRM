"use client";
// Drawer / Modal / Toast. Quy tắc "một lớp phủ tại một thời điểm" (ui-design-system mục 1.2):
// mở lớp phủ mới khi đã có lớp đang mở → bị từ chối (cảnh báo ở dev), không bao giờ chồng drawer lên modal.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { cx } from "./ui";

let openOverlay: HTMLDialogElement | null = null;

function useDialog(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDialogElement>(null);
  const [refused, setRefused] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      if (openOverlay && openOverlay !== el && openOverlay.open) {
        if (process.env.NODE_ENV !== "production") console.warn("Đã có một lớp phủ đang mở — bỏ qua yêu cầu mở thêm.");
        setRefused(true);
        onClose();
        return;
      }
      setRefused(false);
      openOverlay = el;
      el.showModal();
    } else if (!open && el.open) {
      el.close();
    }
  }, [open, onClose]);
  useEffect(() => () => {
    if (openOverlay === ref.current) openOverlay = null;
  }, []);
  const handleClose = () => {
    if (openOverlay === ref.current) openOverlay = null;
    onClose();
  };
  return { ref, refused, handleClose };
}

type OverlayProps = { open: boolean; onClose: () => void; title: string; description?: ReactNode; children: ReactNode; footer?: ReactNode };

export function Drawer({ open, onClose, title, description, children, footer, size = "md" }: OverlayProps & { size?: "md" | "lg" }) {
  const { ref, handleClose } = useDialog(open, onClose);
  return (
    <dialog
      ref={ref}
      className={cx("drawer", size === "lg" && "lg")}
      aria-labelledby="drawer-title"
      onClose={handleClose}
      onClick={(e) => e.target === e.currentTarget && ref.current?.close()}
    >
      {open && (
        <div className="flex h-full flex-col bg-bg">
          <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
            <div>
              <h2 id="drawer-title" className="text-base font-semibold text-fg">{title}</h2>
              {description && <p className="mt-0.5 text-sm text-fg-muted">{description}</p>}
            </div>
            <CloseButton onClick={() => ref.current?.close()} />
          </header>
          <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer && <footer className="flex justify-end gap-2 border-t border-border bg-bg-subtle px-5 py-3">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}

export function Modal({ open, onClose, title, description, children, footer }: OverlayProps) {
  const { ref, handleClose } = useDialog(open, onClose);
  return (
    <dialog ref={ref} className="modal" aria-labelledby="modal-title" onClose={handleClose} onClick={(e) => e.target === e.currentTarget && ref.current?.close()}>
      {open && (
        <div className="bg-bg">
          <header className="flex items-start justify-between gap-3 px-5 pt-4">
            <div>
              <h2 id="modal-title" className="text-base font-semibold text-fg">{title}</h2>
              {description && <p className="mt-0.5 text-sm text-fg-muted">{description}</p>}
            </div>
            <CloseButton onClick={() => ref.current?.close()} />
          </header>
          <div className="px-5 py-4">{children}</div>
          {footer && <footer className="flex justify-end gap-2 px-5 pb-4">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}

function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label="Đóng" className="-mr-1 rounded-[var(--radius-sm)] p-1.5 text-fg-subtle hover:bg-bg-muted hover:text-fg">
      <svg aria-hidden width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8" /></svg>
    </button>
  );
}

// ---- Toast ---------------------------------------------------------------------------------------

type ToastItem = { id: number; text: string; tone: "success" | "danger" };
const ToastCtx = createContext<(text: string, tone?: ToastItem["tone"]) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((text: string, tone: ToastItem["tone"] = "success") => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x, { id, text, tone }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), 5000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-[var(--z-toast)] flex w-80 flex-col gap-2">
        {items.map((t) => (
          <div key={t.id} role="status" className="pointer-events-auto flex items-start gap-2 rounded-[var(--radius-md)] border border-border bg-bg px-4 py-3 text-sm shadow-[var(--shadow-md)]">
            <span aria-hidden className={cx("mt-1.5 size-2 shrink-0 rounded-full", t.tone === "success" ? "bg-success" : "bg-danger")} />
            <span className="text-fg">{t.text}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
