"use client";
// Biểu mẫu cập nhật trạng thái xử lý và đổi mức ưu tiên của ticket chăm sóc.
import { useActionState, useEffect, useState } from "react";
import { FormError, pick, SelectField, TextField, type ActionResult } from "@/components/form";
import { useToast } from "@/components/overlay";
import { Button } from "@/components/ui";
import {
  PRIORITY_LABEL,
  TICKET_PRIORITIES,
  TICKET_STATUS_LABEL,
  TICKET_STATUSES,
} from "@/modules/service/labels";
import type { TicketDetail } from "@/modules/service/tickets";
import { setTicketPriorityAction, setTicketStatusAction } from "../actions";

const STATUS_OPTIONS = TICKET_STATUSES.map((s) => ({
  value: s,
  label: TICKET_STATUS_LABEL[s],
}));

const PRIORITY_OPTIONS = TICKET_PRIORITIES.map((p) => ({
  value: p,
  label: PRIORITY_LABEL[p],
}));

export function StatusPriorityForm({
  ticketId,
  currentStatus,
  currentPriority,
}: {
  ticketId: string;
  currentStatus: TicketDetail["status"];
  currentPriority: TicketDetail["priority"];
}) {
  const [statusState, statusAction, statusPending] = useActionState<ActionResult | null, FormData>(
    setTicketStatusAction,
    null,
  );
  const [priorityState, priorityAction, priorityPending] = useActionState<
    ActionResult | null,
    FormData
  >(setTicketPriorityAction, null);

  const [status, setStatus] = useState<string>(currentStatus);
  const [priority, setPriority] = useState<string>(currentPriority);
  const toast = useToast();

  useEffect(() => {
    setStatus(currentStatus);
  }, [currentStatus]);

  useEffect(() => {
    setPriority(currentPriority);
  }, [currentPriority]);

  useEffect(() => {
    if (!statusState) return;
    toast(
      statusState.message ??
        (statusState.ok ? "Đã cập nhật trạng thái." : "Không thể cập nhật trạng thái."),
      statusState.ok ? "success" : "danger",
    );
    if (!statusState.ok && statusState.values?.status) {
      setStatus(String(statusState.values.status));
    }
  }, [statusState, toast]);

  useEffect(() => {
    if (!priorityState) return;
    toast(
      priorityState.message ??
        (priorityState.ok ? "Đã đổi mức ưu tiên." : "Không thể đổi mức ưu tiên."),
      priorityState.ok ? "success" : "danger",
    );
    if (!priorityState.ok && priorityState.values?.priority) {
      setPriority(String(priorityState.values.priority));
    }
  }, [priorityState, toast]);

  const ds = pick(statusState, { status: currentStatus, note: "" });
  const fs = statusState?.fields ?? {};
  const fp = priorityState?.fields ?? {};

  return (
    <div className="divide-y divide-border">
      <form action={statusAction} noValidate className="p-4">
        <FormError result={statusState} />
        <input type="hidden" name="id" value={ticketId} />
        <SelectField
          label="Trạng thái"
          name="status"
          required
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          options={STATUS_OPTIONS}
          error={fs.status}
        />
        <TextField
          label="Ghi chú trạng thái (tùy chọn)"
          name="note"
          maxLength={500}
          defaultValue={ds.str("note")}
          placeholder="Lý do đóng hoặc kết quả xử lý…"
          error={fs.note}
        />
        <div className="flex justify-end">
          <Button type="submit" size="sm" variant="secondary" disabled={statusPending}>
            {statusPending ? "Đang lưu…" : "Cập nhật trạng thái"}
          </Button>
        </div>
      </form>

      <form action={priorityAction} noValidate className="p-4">
        <FormError result={priorityState} />
        <input type="hidden" name="id" value={ticketId} />
        <SelectField
          label="Mức ưu tiên"
          name="priority"
          required
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          options={PRIORITY_OPTIONS}
          hint="Đổi mức sẽ tính lại hạn"
          error={fp.priority}
        />
        <div className="flex justify-end">
          <Button type="submit" size="sm" variant="secondary" disabled={priorityPending}>
            {priorityPending ? "Đang lưu…" : "Đổi mức ưu tiên"}
          </Button>
        </div>
      </form>
    </div>
  );
}
