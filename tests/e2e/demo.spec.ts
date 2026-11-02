// E2E smoke theo docs/demo-script.md — mỗi vai đi đúng thứ tự bấm của kịch bản demo. Chỉ đọc: không ghi dữ liệu (mở modal rồi đóng).
import { expect, test } from "@playwright/test";
import { collectErrors, follow, login, mainText, switchTeam } from "./helpers";

test.describe("Kịch bản demo", () => {
  test("1. Quản lý — dashboard, báo cáo đa tiền tệ, REV-03 khớp, đơn hai nguồn, khách gộp, AI, nhật ký, cấu hình", async ({ page }) => {
    const errors = collectErrors(page);
    await login(page, "Trần Quản Lý");
    expect(await mainText(page)).toMatch(/30 ngày gần nhất[\s\S]*REV-01/);

    await page.goto("/bao-cao/tai-chinh?group=month&currency=USD&from=2026-01-01&to=2026-10-31");
    const fin = await mainText(page);
    expect(fin).toMatch(/1 USD = [\d.]+ ₫ \(tỷ giá hiệu lực/);
    expect(fin).toContain("Theo nguyên tệ và tỷ giá đã dùng");
    expect(fin).toContain("COD theo hãng vận chuyển");
    await expect(page.locator("figure[aria-label]").first()).toBeVisible(); // biểu đồ kèm bảng

    await page.goto("/don-hang?anchor=delivered");
    expect(await mainText(page)).toMatch(/REV-03/);

    await switchTeam(page, "Team EU");
    await page.goto("/don-hang?q=6031");
    await follow(page, page.getByRole("link", { name: "#6031" }).first());
    expect(await mainText(page)).toMatch(/Nguồn liên kết \(2\)/);

    await switchTeam(page, "Team PiAlpha");
    await page.goto("/khach-hang?q=Sophia%20Johnson");
    await follow(page, page.getByRole("link", { name: "Sophia Johnson" }).first());
    await page.getByRole("tab", { name: /Lịch sử gộp/ }).click();
    expect(await mainText(page)).toMatch(/Tách lại|gộp/i);

    await page.goto("/ai");
    expect(await mainText(page)).toContain("Trung tâm AI");

    await page.goto("/quan-tri/nhat-ky?entity=Setting");
    expect(await mainText(page)).toContain("Nhật ký thao tác");
    await page.goto("/quan-tri/cau-hinh");
    const cfg = await mainText(page);
    for (const s of ["Ngưỡng SLA ticket", "Phân công lead", "Giới hạn liên hệ", "Giờ làm việc theo thị trường", "Ngưỡng tồn thấp"]) expect(cfg).toContain(s);
    expect(errors).toEqual([]);
  });

  test("2. Sales — hàng đợi, nhu cầu mua của mình, soạn phản hồi AI, không vào được vận đơn", async ({ page }) => {
    const errors = collectErrors(page);
    await login(page, "Phạm Sales");
    await page.goto("/hang-doi");
    expect(await mainText(page)).toMatch(/Hàng đợi/);
    await page.goto("/nhu-cau");
    await page.waitForLoadState("networkidle");
    await follow(page, page.locator('main a[href^="/nhu-cau/c"]').first());
    await expect(page.getByRole("button", { name: /Soạn phản hồi/ })).toBeVisible();
    await page.goto("/van-don");
    expect(await mainText(page)).toContain("Không tìm thấy trang");
    await expect(page.getByRole("link", { name: "Vận đơn" })).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("3. Marketing — phân khúc, hành trình, báo cáo marketing không có tiền", async ({ page }) => {
    const errors = collectErrors(page);
    await login(page, "Đỗ Marketing");
    await page.goto("/phan-khuc");
    expect(await mainText(page)).toMatch(/Phân khúc/);
    await page.goto("/hanh-trinh");
    await follow(page, page.getByRole("link", { name: "Nhắc mua lại theo chu kỳ" }).first());
    expect(await mainText(page)).toMatch(/Giả lập|SIMULATED|giả lập/i);
    await page.goto("/bao-cao/marketing");
    const mk = await mainText(page);
    expect(mk).toMatch(/MKT-0[12]/);
    expect(mk).not.toMatch(/REV-0[1-4]/);
    await page.goto("/bao-cao/tai-chinh");
    expect(await mainText(page)).toContain("Không tìm thấy trang");
    expect(errors).toEqual([]);
  });

  test("4. Vận đơn — cần can thiệp, mở hộp xử lý (không ghi), sản phẩm không có giá vốn", async ({ page }) => {
    const errors = collectErrors(page);
    await login(page, "Vũ Vận Đơn");
    await page.goto("/van-don");
    const t = await mainText(page);
    expect(t).toContain("Đơn cần can thiệp");
    expect(t).not.toContain("Đối soát");
    await page.getByRole("button", { name: "Xử lý" }).first().click();
    const dlg = page.getByRole("dialog");
    await expect(dlg).toBeVisible();
    await expect(dlg.getByText("Yêu cầu giao lại", { exact: true }).first()).toBeVisible();
    await dlg.getByRole("button", { name: "Đóng", exact: true }).last().click();
    await expect(dlg).toBeHidden();
    await page.goto("/san-pham");
    await mainText(page);
    await expect(page.locator("main table thead").first()).not.toContainText("Giá vốn"); // mô tả trang có nhắc giá vốn, cột thì không
    expect(errors).toEqual([]);
  });

  test("5. Kế toán — COD bốn mốc theo hãng, không xử lý / không đối soát, bốn mốc ở đơn", async ({ page }) => {
    const errors = collectErrors(page);
    await login(page, "Ngô Kế Toán");
    await page.goto("/van-don?tab=cod&from=2026-10-01&to=2026-10-31");
    const t = await mainText(page);
    expect(t).toMatch(/CASH-01[\s\S]*CASH-02[\s\S]*CASH-03/);
    await expect(page.getByRole("button", { name: "Xử lý" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Đối soát" })).toHaveCount(0);
    await follow(page, page.locator('main table').last().locator('a[href^="/don-hang/"]').first());
    expect(await mainText(page)).toContain("COD — bốn mốc");
    expect(errors).toEqual([]);
  });
});
