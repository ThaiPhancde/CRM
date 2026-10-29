// Che PII theo quyền ở service (docs/permissions.md mục 3): mọi nơi trả SĐT/email ra ngoài đi qua đây.
import { can } from "./permissions";
import { maskEmail, maskPhone } from "./phone";
import type { SessionUser } from "./session";

export function piiFor(user: SessionUser) {
  const full = can(user.roles, "customer.pii");
  return {
    full,
    phone: (p: string | null | undefined) => (full ? (p ?? null) : maskPhone(p)),
    email: (e: string | null | undefined) => (full ? (e ?? null) : maskEmail(e)),
  };
}
