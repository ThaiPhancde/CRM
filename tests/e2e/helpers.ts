import { expect, type Locator, type Page } from "@playwright/test";

/** Đăng nhập thử theo tên người mẫu (DEMO_LOGIN=true). */
export async function login(page: Page, name: string) {
  await page.context().clearCookies();
  await page.goto("/dang-nhap");
  await page.locator("form button", { hasText: name }).click();
  await page.waitForURL((u) => u.pathname === "/");
  await expect(page.locator("main")).toBeVisible();
}

/** Nội dung vùng chính sau khi tải xong (App Router đổi URL trước khi nội dung đổ về — chờ khung "Đang tải" biến mất). */
export async function mainText(page: Page) {
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("status", { name: "Đang tải" })).toHaveCount(0);
  return page.locator("main").innerText();
}

/** Đi theo một liên kết bằng href (không phụ thuộc thời điểm hydrate khi bấm). */
export async function follow(page: Page, link: Locator) {
  const href = await link.getAttribute("href");
  if (!href) throw new Error("Liên kết không có href");
  await page.goto(href);
  await page.waitForLoadState("networkidle");
}

/** Lỗi console (bỏ qua cảnh báo React dev / favicon). */
export function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error" && !/favicon|Download the React DevTools/.test(m.text())) errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

/** Đổi team qua bộ chọn ở thanh trên (server action) — chờ action ghi xong rồi mới đi tiếp. */
export async function switchTeam(page: Page, name: string) {
  await Promise.all([
    page.waitForResponse((r) => r.request().method() === "POST" && r.status() < 400),
    page.getByRole("combobox", { name: "Chọn team" }).selectOption({ label: name }),
  ]);
  await page.waitForLoadState("networkidle");
}
