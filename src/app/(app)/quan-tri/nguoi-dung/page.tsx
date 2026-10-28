import { pageUser } from "@/lib/current-user";
import { bindTenant, db } from "@/lib/db";
import { listMembers } from "@/modules/admin/service";
import { MembersView } from "./view";

export default async function MembersPage() {
  const user = await pageUser("admin.users");
  bindTenant(user);
  const [members, teams] = await Promise.all([listMembers(user), db.team.findMany({ where: { active: true }, orderBy: { name: "asc" } })]);
  return (
    <MembersView
      workspaceName={user.workspace.name}
      currentUserId={user.id}
      teams={teams.map((t) => ({ value: t.id, label: t.name }))}
      members={members.map((m) => ({
        id: m.id, userId: m.userId, name: m.user.name, email: m.user.email, roles: m.roles,
        teamId: m.teamId, teamName: m.team?.name ?? null, active: m.active && m.user.active,
      }))}
    />
  );
}
