import { describe, expect, it } from "vitest";
import { makeUser, makeWorkspace, RUN } from "./helpers";
import { db, rootDb, runInWorkspace, workspaceDb } from "@/lib/db";
import { can, PERMISSIONS, ROLES } from "@/lib/permissions";
import { loadUser, requirePerm, signSession, verifySession } from "@/lib/session";
import { once } from "@/lib/idempotency";
import { audit } from "@/lib/audit";
import { HttpError } from "@/lib/errors";
import { base, dateTimeCsv, money } from "@/lib/format";

describe("cô lập workspace (D-03)", () => {
  it("truy vấn bảng thuộc workspace mà thiếu ngữ cảnh bị từ chối", async () => {
    await expect(db.brand.findMany()).rejects.toThrow(/Thiếu ngữ cảnh workspace/);
  });

  it("workspace A không thấy, không sửa được dữ liệu của B", async () => {
    const a = await makeWorkspace("iso-a");
    const b = await makeWorkspace("iso-b");
    const brandB = await workspaceDb(b.id).brand.create({ data: { code: "BR", name: "Brand B" } as never });
    expect(brandB.workspaceId).toBe(b.id);

    await runInWorkspace(a.id, async () => {
      expect(await db.brand.findMany()).toEqual([]);
      expect(await db.brand.findUnique({ where: { id: brandB.id } })).toBeNull();
      const res = await db.brand.updateMany({ where: { id: brandB.id }, data: { name: "hack" } });
      expect(res.count).toBe(0);
    });
    expect((await rootDb.brand.findUnique({ where: { id: brandB.id } }))?.name).toBe("Brand B");
  });

  it("ghi kèm workspaceId của workspace khác bị chặn", async () => {
    const a = await makeWorkspace("stamp-a");
    const b = await makeWorkspace("stamp-b");
    await expect(
      workspaceDb(a.id).brand.create({ data: { code: "X", name: "x", workspaceId: b.id } as never }),
    ).rejects.toThrow(/workspace khác/);
  });

  it("tạo lồng (store trong brand) cũng được gán workspace", async () => {
    const a = await makeWorkspace("nested");
    const brand = await workspaceDb(a.id).brand.create({
      data: { code: "N", name: "n", stores: { create: [{ code: "S1", name: "s1", platform: "shopify" }] } } as never,
      include: { stores: true },
    });
    expect((brand as unknown as { stores: { workspaceId: string }[] }).stores[0].workspaceId).toBe(a.id);
  });
});

describe("quyền (D-21, D-34)", () => {
  it("mọi quyền có ít nhất một vai trò, MANAGER có quyền quản trị", () => {
    for (const p of PERMISSIONS) expect(ROLES.some((r) => can([r], p))).toBe(true);
    expect(can(["MANAGER"], "admin.users")).toBe(true);
    expect(can(["SALES"], "admin.users")).toBe(false);
    expect(can(["SALES"], "finance.view")).toBe(false);
    expect(can(["FINANCE_VIEW"], "finance.view")).toBe(true);
  });

  it("requirePerm ném 403 khi thiếu quyền", async () => {
    const w = await makeWorkspace("perm");
    const u = await makeUser("sales", { workspaceId: w.id, roles: ["SALES"] });
    const su = (await loadUser(u.id))!;
    expect(() => requirePerm(su, "admin.users")).toThrow(HttpError);
    try {
      requirePerm(su, "admin.users");
    } catch (e) {
      expect((e as HttpError).status).toBe(403);
    }
  });
});

describe("phiên và chọn workspace", () => {
  it("token ký đúng thì đọc được, sai/hết hạn/rỗng thì null", async () => {
    const t = await signSession("u1");
    expect(await verifySession(t)).toBe("u1");
    expect(await verifySession(t.slice(0, -2) + "xx")).toBeNull();
    expect(await verifySession(undefined)).toBeNull();
  });

  it("người dùng thường chỉ vào workspace có membership; cookie trỏ workspace khác bị bỏ qua", async () => {
    const a = await makeWorkspace("sel-a");
    const b = await makeWorkspace("sel-b");
    const u = await makeUser("mkt", { workspaceId: a.id, roles: ["MARKETING"] });
    const su = (await loadUser(u.id, b.id))!;
    expect(su.workspaceId).toBe(a.id);
    expect(su.workspaces.map((w) => w.id)).toEqual([a.id]);
    expect(su.roles).toEqual(["MARKETING"]);
  });

  it("quản trị công ty vào mọi workspace, không có membership thì mang MANAGER", async () => {
    const b = await makeWorkspace("admin-b");
    const u = await makeUser("admin", { isCompanyAdmin: true });
    const su = (await loadUser(u.id, b.id))!;
    expect(su.workspaceId).toBe(b.id);
    expect(su.roles).toEqual(["MANAGER"]);
  });

  it("tài khoản khóa hoặc không có workspace nào → null", async () => {
    const w = await makeWorkspace("locked");
    const locked = await makeUser("locked", { workspaceId: w.id, roles: ["SALES"], active: false });
    const orphan = await makeUser("orphan");
    expect(await loadUser(locked.id)).toBeNull();
    expect(await loadUser(orphan.id)).toBeNull();
  });
});

describe("idempotency và audit (D-16)", () => {
  it("cùng (scope, key) chỉ chạy một lần, lần sau trả kết quả cũ", async () => {
    const w = await makeWorkspace("idem");
    let calls = 0;
    await runInWorkspace(w.id, async () => {
      const r1 = await once("test", `k-${RUN}`, async () => (++calls, "ref-1"));
      const r2 = await once("test", `k-${RUN}`, async () => (++calls, "ref-2"));
      expect(r1).toEqual({ ref: "ref-1", replayed: false });
      expect(r2).toEqual({ ref: "ref-1", replayed: true });
    });
    expect(calls).toBe(1);
  });

  it("chạy song song cùng khóa vẫn chỉ một lần", async () => {
    const w = await makeWorkspace("idem-par");
    let calls = 0;
    const res = await runInWorkspace(w.id, () =>
      Promise.all(Array.from({ length: 5 }, () => once("test", `p-${RUN}`, async () => (++calls, "ok")))),
    );
    expect(calls).toBe(1);
    expect(res.filter((r) => !r.replayed)).toHaveLength(1);
  });

  it("thất bại thì nhả khóa để thử lại", async () => {
    const w = await makeWorkspace("idem-fail");
    await runInWorkspace(w.id, async () => {
      await expect(once("test", "f", async () => Promise.reject(new Error("boom")))).rejects.toThrow("boom");
      expect(await once("test", "f", async () => "ok")).toEqual({ ref: "ok", replayed: false });
    });
  });

  it("audit ghi đúng workspace của ngữ cảnh", async () => {
    const w = await makeWorkspace("audit");
    const row = await runInWorkspace(w.id, () => audit(db, { actorId: "u", entity: "Brand", entityId: "b1", action: "create", after: { a: 1 } }));
    expect(row.workspaceId).toBe(w.id);
  });
});

describe("định dạng tiền (D-44)", () => {
  it("VND không lẻ, KWD 3 số lẻ, còn lại 2", () => {
    const digits = (x: string) => x.replace(/\D/g, "");
    expect(digits(base("2698380.4"))).toBe("2698380");
    expect(base("1")).toContain("₫");
    expect(digits(money("3.25", "KWD"))).toBe("3250");
    expect(digits(money("102.6", "USD"))).toBe("10260");
  });

  it("ngày xuất CSV theo giờ Việt Nam (UTC+7), qua nửa đêm đổi ngày", () => {
    expect(dateTimeCsv(new Date("2026-10-27T16:11:43.956Z"))).toBe("27/10/2026 23:11");
    expect(dateTimeCsv(new Date("2026-10-27T17:05:00Z"))).toBe("28/10/2026 00:05");
  });
});
