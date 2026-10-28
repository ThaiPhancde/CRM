import { describe, expect, it } from "vitest";
import { makeUser, makeWorkspace, RUN } from "./helpers";
import { rootDb } from "@/lib/db";
import { loadUser } from "@/lib/session";
import { addMember, getCatalog, listMembers, saveCatalog, updateMember, ValidationError } from "@/modules/admin/service";

async function setup(tag: string) {
  const ws = await makeWorkspace(tag);
  const mgr = (await loadUser((await makeUser(`${tag}-mgr`, { workspaceId: ws.id, roles: ["MANAGER"] })).id))!;
  const sales = (await loadUser((await makeUser(`${tag}-sales`, { workspaceId: ws.id, roles: ["SALES"] })).id))!;
  return { ws, mgr, sales };
}

const fieldsOf = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    if (e instanceof ValidationError) return e.fields;
    throw e;
  }
  throw new Error("không ném ValidationError");
};

describe("thành viên", () => {
  it("chỉ Quản lý xem/thêm thành viên; Sales bị 403", async () => {
    const { mgr, sales } = await setup("mem-perm");
    expect((await listMembers(mgr)).length).toBe(2);
    await expect(listMembers(sales)).rejects.toMatchObject({ status: 403 });
    await expect(addMember(sales, { email: `x-${RUN}@t.invalid`, name: "X", roles: ["SALES"] })).rejects.toMatchObject({ status: 403 });
  });

  it("thêm thành viên ghi audit; thêm trùng báo lỗi trường email", async () => {
    const { ws, mgr } = await setup("mem-add");
    const email = `new-${RUN}@t.invalid`;
    const m = await addMember(mgr, { email, name: "Mới", roles: ["MARKETING"] });
    expect(m.workspaceId).toBe(ws.id);
    expect(await rootDb.auditLog.count({ where: { workspaceId: ws.id, entityId: m.id } })).toBe(1);
    expect(await fieldsOf(addMember(mgr, { email, name: "Mới", roles: ["MARKETING"] }))).toHaveProperty("email");
    expect(await fieldsOf(addMember(mgr, { email: "sai", name: "", roles: [] }))).toMatchObject({ email: expect.any(String), name: expect.any(String), roles: expect.any(String) });
  });

  it("không tự khóa / tự bỏ quyền Quản lý; không sửa thành viên team khác", async () => {
    const { mgr } = await setup("mem-self");
    const other = await setup("mem-other");
    const mine = (await listMembers(mgr)).find((m) => m.userId === mgr.id)!;
    expect(await fieldsOf(updateMember(mgr, { id: mine.id, roles: ["SALES"], active: true }))).toHaveProperty("roles");
    const theirs = (await listMembers(other.mgr))[0];
    await expect(updateMember(mgr, { id: theirs.id, roles: ["SALES"], active: true })).rejects.toMatchObject({ status: 404 });
  });
});

describe("danh mục", () => {
  it("tạo brand → store gắn market của cùng team; mã trùng báo lỗi trường code", async () => {
    const { mgr } = await setup("cat");
    const brand = await saveCatalog(mgr, "brand", { code: "abc", name: "ABC" });
    const market = await saveCatalog(mgr, "market", { code: "ae", name: "UAE", currency: "aed", paymentMode: "COD", timezone: "Asia/Dubai", locale: "ar-AE" });
    const store = await saveCatalog(mgr, "store", { code: "s1", name: "S1", brandId: brand!.id, platform: "TikTokShop", marketIds: [market!.id] });
    expect(store).toMatchObject({ code: "S1", platform: "tiktokshop" });
    expect(await fieldsOf(saveCatalog(mgr, "brand", { code: "ABC", name: "Khác" }))).toHaveProperty("code");
    const cat = await getCatalog(mgr);
    expect(cat.brands.map((b) => b.code)).toEqual(["ABC"]);
  });

  it("store không gắn được brand/market của team khác", async () => {
    const a = await setup("cat-a");
    const b = await setup("cat-b");
    const brandB = await saveCatalog(b.mgr, "brand", { code: "B", name: "B" });
    const mB = await saveCatalog(b.mgr, "market", { code: "DE", name: "Đức", currency: "EUR", paymentMode: "PREPAID", timezone: "Europe/Berlin", locale: "de-DE" });
    const brandA = await saveCatalog(a.mgr, "brand", { code: "A", name: "A" });
    const mA = await saveCatalog(a.mgr, "market", { code: "FR", name: "Pháp", currency: "EUR", paymentMode: "PREPAID", timezone: "Europe/Paris", locale: "fr-FR" });
    expect(await fieldsOf(saveCatalog(a.mgr, "store", { code: "X", name: "X", brandId: brandB!.id, platform: "shopify", marketIds: [mA!.id] }))).toHaveProperty("brandId");
    expect(await fieldsOf(saveCatalog(a.mgr, "store", { code: "X", name: "X", brandId: brandA!.id, platform: "shopify", marketIds: [mB!.id] }))).toHaveProperty("marketIds");
  });

  it("market validate mã ISO, múi giờ IANA", async () => {
    const { mgr } = await setup("cat-val");
    const f = await fieldsOf(saveCatalog(mgr, "market", { code: "UAE", name: "x", currency: "DH", paymentMode: "COD", timezone: "Dubai", locale: "arabic" }));
    expect(Object.keys(f).sort()).toEqual(["code", "currency", "locale", "timezone"]);
  });

  it("tỷ giá chỉ thêm mốc mới, giữ Decimal chính xác; trùng ngày báo lỗi", async () => {
    const { mgr } = await setup("fx");
    const r = await saveCatalog(mgr, "fxRate", { currency: "kwd", rateToUsd: "3.25123456", validFrom: "2026-02-01" });
    expect((r as unknown as { rateToUsd: { toString(): string } }).rateToUsd.toString()).toBe("3.25123456");
    expect(await fieldsOf(saveCatalog(mgr, "fxRate", { currency: "KWD", rateToUsd: "3.3", validFrom: "2026-02-01" }))).toHaveProperty("validFrom");
    expect(await fieldsOf(saveCatalog(mgr, "fxRate", { currency: "KWD", rateToUsd: "-1", validFrom: "2026-03-01" }))).toHaveProperty("rateToUsd");
  });

  it("Sales xem được danh mục nhưng không sửa", async () => {
    const { sales } = await setup("cat-sales");
    await expect(getCatalog(sales)).resolves.toBeTruthy();
    await expect(saveCatalog(sales, "brand", { code: "Z", name: "Z" })).rejects.toMatchObject({ status: 403 });
  });
});
