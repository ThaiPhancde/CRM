// Quy tắc giao diện (Phase 11.2, ui-design-system): một lớp phủ tại một thời điểm, không cuộn ngang ở 768/1280/1440/1920,
// focus bàn phím nhìn thấy được, trạng thái rỗng và lỗi có nội dung tiếng Việt.
import { expect, test } from "@playwright/test";
import { follow, login, mainText } from "./helpers";

test("không chồng lớp: đang mở drawer thì modal không mở thêm", async ({ page }) => {
  await login(page, "Trần Quản Lý");
  await page.goto("/khach-hang");
  await page.waitForLoadState("networkidle");
  await follow(page, page.locator('main a[href^="/khach-hang/c"]').first());
  await page.getByRole("button", { name: /Tóm tắt AI/ }).click();
  await expect(page.locator("dialog[open]")).toHaveCount(1);
  // Nút mở modal nằm dưới lớp phủ (trang bị khóa) → bấm bằng script như một sự kiện lạc; lớp phủ thứ hai phải bị từ chối.
  await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent?.includes("Xóa dữ liệu theo yêu cầu"))?.click());
  await page.waitForTimeout(300);
  await expect(page.locator("dialog[open]")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(page.locator("dialog[open]")).toHaveCount(0);
});

for (const width of [768, 1280, 1440, 1920]) {
  test(`không cuộn ngang ở ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await login(page, "Trần Quản Lý");
    for (const path of ["/", "/don-hang", "/khach-hang", "/van-don", "/bao-cao/tai-chinh", "/san-pham", "/quan-tri/cau-hinh"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(over, `${path} rộng hơn màn ${width}px`).toBeLessThanOrEqual(1);
    }
  });
}

test("focus bàn phím nhìn thấy được (viền 2px)", async ({ page }) => {
  await login(page, "Trần Quản Lý");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  const outline = await page.evaluate(() => { const el = document.activeElement as HTMLElement; const s = getComputedStyle(el); return { w: s.outlineWidth, style: s.outlineStyle }; });
  expect(outline).toEqual({ w: "2px", style: "solid" });
});

test("trạng thái rỗng và lỗi có nội dung tiếng Việt", async ({ page }) => {
  await login(page, "Trần Quản Lý");
  await page.goto("/don-hang?q=khong-co-don-nao-xyz");
  expect(await mainText(page)).toMatch(/Không có|Chưa có/);
  await page.goto("/van-don?tab=can-thiep&q=khong-co-xyz");
  expect(await mainText(page)).toContain("Không có đơn khớp bộ lọc");
  await page.goto("/don-hang/khong-ton-tai");
  expect(await mainText(page)).toContain("Không tìm thấy trang");
});
