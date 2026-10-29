"use client";
// Bảng Kanban nhu cầu mua theo 6 giai đoạn: hỗ trợ kéo thả HTML5 + ô chọn giai đoạn bằng bàn phím + Modal nhập lý do từ chối/mất liên lạc.
import Link from "next/link";
import { startTransition, useActionState, useEffect, useState } from "react";
import { Field, FormError, pick, type ActionResult } from "@/components/form";
import { Modal, useToast } from "@/components/overlay";
import { Badge, Button, cx, type Tone } from "@/components/ui";
import { dateTime, money, num } from "@/lib/format";
import { LEAD_STAGES, STAGE_LABEL, STAGE_TONE } from "@/modules/sales/labels";
import type { leadBoard } from "@/modules/sales/leads";
import { changeStageAction } from "./actions";

export type Stage = (typeof LEAD_STAGES)[number];
export type LeadBoardProps = Awaited<ReturnType<typeof leadBoard>>;

const NEED_REASON: readonly Stage[] = ["TU_CHOI", "MAT_LIEN_LAC"];

type PendingLoss = {
  id: string;
  contactName: string;
  stage: Stage;
};

export function LeadBoard({ columns, canEdit }: LeadBoardProps) {
  const [state, submitStage, pending] = useActionState<ActionResult | null, FormData>(changeStageAction, null);
  const toast = useToast();
  const [dragging, setDragging] = useState<{ id: string; contactName: string; stage: Stage } | null>(null);
  const [dragOverStage, setDragOverStage] = useState<Stage | null>(null);
  const [pendingLoss, setPendingLoss] = useState<PendingLoss | null>(null);

  useEffect(() => {
    if (!state) return;
    toast(
      state.message ?? (state.ok ? "Đã cập nhật giai đoạn." : "Không thể cập nhật giai đoạn."),
      state.ok ? "success" : "danger",
    );
    if (state.ok) {
      setPendingLoss(null);
    }
  }, [state, toast]);

  const requestStageChange = (id: string, contactName: string, fromStage: Stage, toStage: Stage) => {
    if (!canEdit || fromStage === toStage) return;
    if (NEED_REASON.includes(toStage)) {
      setPendingLoss({ id, contactName, stage: toStage });
      return;
    }
    const fd = new FormData();
    fd.set("id", id);
    fd.set("stage", toStage);
    startTransition(() => {
      submitStage(fd);
    });
  };

  const colMap = new Map(columns.map((c) => [c.stage, c]));
  const orderedColumns = LEAD_STAGES.map((stage) => colMap.get(stage) ?? { stage, total: 0, rows: [] });

  const d = pick(state, null);
  const fieldErrors = state?.fields ?? {};

  return (
    <>
      <div className="overflow-x-auto pb-2 xl:overflow-x-visible">
        <div className="grid grid-cols-1 gap-3 lg:min-w-[1140px] lg:grid-cols-6 xl:min-w-0">
          {orderedColumns.map((col) => {
            const isOver = dragOverStage === col.stage && dragging && dragging.stage !== col.stage;
            return (
              <section
                key={col.stage}
                aria-label={`Cột ${STAGE_LABEL[col.stage]}`}
                onDragOver={(e) => {
                  if (!canEdit || !dragging) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (dragOverStage !== col.stage) setDragOverStage(col.stage);
                }}
                onDragLeave={() => {
                  if (dragOverStage === col.stage) setDragOverStage(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverStage(null);
                  if (!canEdit) return;
                  let payload = dragging;
                  if (!payload) {
                    try {
                      payload = JSON.parse(e.dataTransfer.getData("application/json")) as {
                        id: string;
                        contactName: string;
                        stage: Stage;
                      };
                    } catch {
                      payload = null;
                    }
                  }
                  setDragging(null);
                  if (payload) {
                    requestStageChange(payload.id, payload.contactName, payload.stage, col.stage);
                  }
                }}
                className={cx(
                  "flex max-h-[calc(100vh-260px)] min-h-[360px] flex-col rounded-[var(--radius-md)] border bg-bg-subtle transition-colors",
                  isOver ? "border-brand bg-brand-soft/40" : "border-border",
                )}
              >
                <header className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
                  <Badge tone={STAGE_TONE[col.stage]}>{STAGE_LABEL[col.stage]}</Badge>
                  <span className="tabular text-xs font-semibold text-fg-muted">{num(col.total)}</span>
                </header>

                <div className="flex-1 space-y-2 overflow-y-auto p-2.5">
                  {col.rows.length === 0 ? (
                    <p className="py-8 text-center text-xs text-fg-subtle">Chưa có nhu cầu ở giai đoạn này</p>
                  ) : (
                    col.rows.map((lead) => (
                      <article
                        key={lead.id}
                        draggable={canEdit && !pending}
                        onDragStart={(e) => {
                          if (!canEdit) return;
                          const item = { id: lead.id, contactName: lead.contactName, stage: lead.stage };
                          setDragging(item);
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("application/json", JSON.stringify(item));
                        }}
                        onDragEnd={() => {
                          setDragging(null);
                          setDragOverStage(null);
                        }}
                        className={cx(
                          "rounded-[var(--radius-sm)] border border-border bg-bg p-3 shadow-[var(--shadow-sm)] transition-shadow",
                          canEdit && "cursor-grab active:cursor-grabbing hover:border-brand-ring",
                          dragging?.id === lead.id && "opacity-50",
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <Link
                            href={`/nhu-cau/${lead.id}`}
                            className="line-clamp-1 text-sm font-medium text-fg hover:text-brand-active"
                          >
                            {lead.contactName}
                          </Link>
                          {lead.overdue && <Badge tone="danger">Quá hạn</Badge>}
                        </div>

                        {(lead.phone || lead.email) && (
                          <p className="tabular mt-0.5 truncate text-xs text-fg-subtle">
                            {lead.phone ?? lead.email}
                          </p>
                        )}

                        <p className="mt-1.5 line-clamp-2 text-xs text-fg-muted">
                          {lead.interest ?? "Chưa ghi chi tiết nhu cầu"}
                        </p>

                        {lead.budget && lead.budget.currency && (
                          <p className="tabular mt-1 text-xs font-medium text-fg">
                            {money(lead.budget.amount, lead.budget.currency)}
                          </p>
                        )}

                        <div className="mt-2 flex flex-wrap items-center justify-between gap-1.5 text-xs">
                          {lead.owner ? (
                            <span className="truncate text-fg-muted">{lead.owner.name}</span>
                          ) : (
                            <Badge tone="warning">Chưa giao</Badge>
                          )}
                          {lead.overdue && lead.firstResponseDueAt ? (
                            <span className="tabular text-[11px] font-medium text-danger">
                              Hạn: {dateTime(lead.firstResponseDueAt)}
                            </span>
                          ) : lead.brand || lead.market ? (
                            <span className="truncate text-[11px] text-fg-subtle">
                              {[lead.brand?.code, lead.market?.code].filter(Boolean).join(" · ")}
                            </span>
                          ) : null}
                        </div>

                        {canEdit && (
                          <div className="mt-2 border-t border-border pt-2">
                            <label htmlFor={`stage-select-${lead.id}`} className="sr-only">
                              Đổi giai đoạn cho {lead.contactName}
                            </label>
                            <select
                              id={`stage-select-${lead.id}`}
                              aria-label={`Đổi giai đoạn cho ${lead.contactName}`}
                              value={lead.stage}
                              disabled={pending}
                              onChange={(e) =>
                                requestStageChange(
                                  lead.id,
                                  lead.contactName,
                                  lead.stage,
                                  e.target.value as Stage,
                                )
                              }
                              className="h-7 w-full rounded-[var(--radius-sm)] border border-border bg-bg px-2 text-xs text-fg focus:border-brand-ring disabled:opacity-50"
                            >
                              {LEAD_STAGES.map((s) => (
                                <option key={s} value={s}>
                                  {STAGE_LABEL[s]}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </article>
                    ))
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {pendingLoss && (
        <Modal
          open
          onClose={() => setPendingLoss(null)}
          title={`Chuyển sang "${STAGE_LABEL[pendingLoss.stage]}"`}
          description={`Vui lòng nhập lý do chưa chốt được đơn cho khách "${pendingLoss.contactName}".`}
          footer={
            <>
              <Button onClick={() => setPendingLoss(null)}>Hủy</Button>
              <Button variant="primary" type="submit" form="lost-reason-form" disabled={pending}>
                {pending ? "Đang lưu…" : "Xác nhận"}
              </Button>
            </>
          }
        >
          <form id="lost-reason-form" action={submitStage} noValidate>
            <FormError result={state && !state.ok ? state : null} />
            <input type="hidden" name="id" value={pendingLoss.id} />
            <input type="hidden" name="stage" value={pendingLoss.stage} />
            <Field label="Lý do" name="lostReason" required error={fieldErrors.lostReason}>
              <textarea
                id="lostReason"
                name="lostReason"
                required
                rows={3}
                maxLength={500}
                defaultValue={d.str("lostReason")}
                placeholder="VD: Khách chê giá cao, muốn chờ đợt khuyến mãi, gọi 3 lần không nghe máy…"
                aria-invalid={!!fieldErrors.lostReason}
                className={cx(
                  "w-full rounded-[var(--radius-sm)] border bg-bg px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus:border-brand-ring",
                  fieldErrors.lostReason ? "border-danger" : "border-border",
                )}
              />
            </Field>
          </form>
        </Modal>
      )}
    </>
  );
}
