"use client";
import { useActionState, useEffect, useState } from "react";
import { DataTable, type Column } from "@/components/data-table";
import { Drawer, useToast } from "@/components/overlay";
import { CheckboxGroup, FormError, pick, SelectField, Switch, TextField, type ActionResult } from "@/components/form";
import { Badge, Button, Card, EmptyState, PageHeader } from "@/components/ui";
import { ROLE_LABEL, ROLES, type Role } from "@/lib/permissions";
import { addMemberAction, updateMemberAction } from "../actions";

type Member = { id: string; userId: string; name: string; email: string; roles: Role[]; teamId: string | null; teamName: string | null; active: boolean };
const roleOptions = ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] }));

export function MembersView({ members, teams, workspaceName, currentUserId }: { members: Member[]; teams: { value: string; label: string }[]; workspaceName: string; currentUserId: string }) {
  const [editing, setEditing] = useState<Member | "new" | null>(null);
  const columns: Column<Member>[] = [
    {
      key: "name", header: "Thành viên", sortValue: (m) => `${m.name} ${m.email}`,
      cell: (m) => (
        <div className="min-w-0">
          <p className="font-medium text-fg">{m.name}{m.userId === currentUserId && <span className="ml-1.5 text-xs font-normal text-fg-subtle">(bạn)</span>}</p>
          <p className="text-xs text-fg-muted">{m.email}</p>
        </div>
      ),
    },
    { key: "roles", header: "Vai trò", sortValue: (m) => m.roles.map((r) => ROLE_LABEL[r]).join(", "), cell: (m) => <div className="flex flex-wrap gap-1">{m.roles.map((r) => <Badge key={r} tone={r === "MANAGER" ? "brand" : "neutral"}>{ROLE_LABEL[r]}</Badge>)}</div> },
    { key: "team", header: "Nhóm", sortValue: (m) => m.teamName, cell: (m) => m.teamName ?? <span className="text-fg-subtle">—</span> },
    { key: "status", header: "Trạng thái", sortValue: (m) => (m.active ? 1 : 0), cell: (m) => (m.active ? <Badge tone="success">Đang hoạt động</Badge> : <Badge tone="danger">Đã khóa</Badge>) },
  ];

  return (
    <>
      <PageHeader
        title="Người dùng"
        description={`Thành viên của ${workspaceName} và vai trò của họ. Khóa tài khoản để thu hồi quyền ngay.`}
        crumbs={[{ label: "Hệ thống" }, { label: "Người dùng" }]}
        actions={<Button variant="primary" onClick={() => setEditing("new")}>+ Thêm thành viên</Button>}
      />
      <Card>
        <DataTable
          caption="Danh sách thành viên"
          rows={members}
          columns={columns}
          rowKey={(m) => m.id}
          onRowClick={setEditing}
          searchPlaceholder="Tìm theo tên, email, vai trò…"
          empty={<EmptyState title="Chưa có thành viên" description="Thêm người đầu tiên để bắt đầu phân công." action={<Button variant="primary" onClick={() => setEditing("new")}>+ Thêm thành viên</Button>} />}
        />
      </Card>
      <MemberDrawer key={editing === "new" ? "new" : editing?.id ?? "closed"} member={editing} teams={teams} onClose={() => setEditing(null)} />
    </>
  );
}

function MemberDrawer({ member, teams, onClose }: { member: Member | "new" | null; teams: { value: string; label: string }[]; onClose: () => void }) {
  const isNew = member === "new";
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(isNew ? addMemberAction : updateMemberAction, null);
  const toast = useToast();
  useEffect(() => {
    if (state?.ok) {
      toast(state.message ?? "Đã lưu.");
      onClose();
    }
  }, [state, toast, onClose]);
  const m = member && member !== "new" ? member : null;
  const d = pick(state, m);
  const f = state?.fields ?? {};

  return (
    <Drawer
      open={member !== null}
      onClose={onClose}
      title={isNew ? "Thêm thành viên" : "Sửa thành viên"}
      description={m ? `${m.name} · ${m.email}` : "Người chưa có tài khoản sẽ được tạo mới theo email."}
      footer={
        <>
          <Button onClick={onClose}>Hủy</Button>
          <Button variant="primary" type="submit" form="member-form" disabled={pending}>{pending ? "Đang lưu…" : "Lưu"}</Button>
        </>
      }
    >
      <form id="member-form" action={action} noValidate>
        <FormError result={state} />
        {m ? (
          <input type="hidden" name="id" value={m.id} />
        ) : (
          <>
            <TextField label="Email" name="email" type="email" required autoComplete="off" placeholder="ten@levelupvn.com" defaultValue={d.str("email")} error={f.email} />
            <TextField label="Họ tên" name="name" required defaultValue={d.str("name")} error={f.name} />
          </>
        )}
        <CheckboxGroup label="Vai trò" name="roles" required options={roleOptions} defaultValue={d.list("roles")} error={f.roles} />
        <SelectField label="Nhóm" name="teamId" options={teams} placeholder="— Không thuộc nhóm —" defaultValue={d.str("teamId")} error={f.teamId} hint="Dùng cho phân công lead theo nhóm (Phase 4)." />
        {m && (
          <>
            <input type="hidden" name="_hasActive" value="1" />
            <Switch label="Đang hoạt động (bỏ chọn để khóa)" name="active" defaultChecked={d.bool("active")} />
          </>
        )}
      </form>
    </Drawer>
  );
}
