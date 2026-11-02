# Biên bản nghiệm thu Phase 9 — Báo cáo và dashboard

- **Ngày:** 02/11/2026
- **Yêu cầu:** người dùng yêu cầu làm xong Phase 9 thì nghiệm thu, rồi mới sang Phase 10.
- **Người kiểm:** Claude, đối chiếu tiêu chí "Nghiệm thu" Phase 9 trong `Thiet_ke_CRM_va_prompt_Claude.md` mục 10 và quy tắc chịu tải D-48.
- **Phiếu ký chính thức:** thuộc người dùng và giám đốc (D-30).
- **Kết quả chung:**
  - `npx vitest run` → 15 file, **444 passed, 1 skipped**. Ca bỏ qua là chạy thử BigQuery thật, chỉ chạy khi có khóa.
  - `npx tsc --noEmit` sạch; `next build` thành công (commit `c9433fd`).
  - Đo tải 200k khách / 600k đơn: **11/11 báo cáo + dashboard < 3 s** (`docs/perf/phase9.json`).

| Tiêu chí | Bằng chứng | Kết quả |
|---|---|---|
| Tổng REV-03 báo cáo khớp tổng đơn trên /don-hang cùng bộ lọc | Test `tests/reports.test.ts`: tính tay 3.478.000 ₫ (giao một phần + hoàn, đơn hủy, đặt trong kỳ giao ngoài kỳ, hai tiền tệ) = báo cáo = `/don-hang` (Mốc ngày: ngày giao). **Đối chiếu toàn bộ DB demo:** 2 team × 3 kỳ (3 tháng, 1 tháng, 12 tháng) × mọi shop / mọi thị trường / không lọc, so `financeReport` với `listOrders` cho REV-01 và REV-03 → **khớp tuyệt đối 84/84** (so chuỗi số, không làm tròn). | **Đạt** |
| Đổi tiền tệ báo cáo thấy tỷ giá | Test: chọn USD → số = VND ÷ FxRate hiệu lực ngày cuối kỳ. Trình duyệt: báo cáo khách hàng đổi USD hiện "1 USD = 26.300 ₫ (hiệu lực 01/01/2025)"; bảng theo nguyên tệ có cột tỷ giá bình quân đã dùng. | **Đạt** |
| Người thiếu `finance.view` không thấy nhóm tài chính | Test: thiếu `finance.view` → 403 nhóm tài chính, tiền ẩn ở nhóm khác. Trình duyệt (Marketing): mục lục `/bao-cao` không có thẻ Tài chính; `/bao-cao/tai-chinh` hiện trang 404, HTML không chứa REV-01; `/bao-cao/tai-chinh/xuat` → 404; dashboard không có khối doanh thu. Sales: `/bao-cao/khach-hang` → 404, báo cáo bán hàng phạm vi "Của tôi", ghi "Số tiền ẩn — cần quyền xem tiền". | **Đạt** |
| Biểu đồ và bảng cùng số | `ReportChart` nhận đúng mảng dữ liệu của bảng bên dưới (một nguồn). Trình duyệt (Quản lý, tài chính theo tháng): tooltip tháng 8 REV-01 169.486.484 / REV-03 125.899.448 = dòng tháng 8 của bảng. | **Đạt** |
| Dashboard theo vai | Quản lý: REV-01..04 theo brand × thị trường, phễu, SLA, cảnh báo. Sales: hàng đợi + "Kết quả của tôi" + SLA ticket. Marketing: phễu, nguồn lead, mua lại; không có tiền. Console 0 lỗi. | **Đạt** |
| Xuất Excel | 6 nhóm (Quản lý) → 200, file zip hợp lệ, có dòng kỳ/phạm vi/tiền tệ/tỷ giá. Nhóm không được xem → 404. | **Đạt** |
| Chịu tải (D-48) | Tài chính 12 tháng 1,5 s (theo tháng 2,1 s), khách hàng 2,2 s, dashboard Quản lý 1,5 s, các nhóm khác < 0,4 s. | **Đạt** (xem trước phân khúc 512 ms sát ngưỡng 500 — thao tác cũ Phase 7, dao động máy dev) |

## Lỗi tìm thấy khi nghiệm thu (đã sửa, `c9433fd`)

- Tổng tiền cộng bằng số thực: tổng 12 tháng lệch 0,00000001 so với `/don-hang` (490.824.496,91999996 vs ,92). Sửa: gộp nhóm và tổng đều cộng bằng `Prisma.Decimal` (`fold`, `dsum`).
- Thị trường không có đơn: báo cáo trả rỗng (null), `/don-hang` trả 0. Sửa: `dsum` của mảng rỗng → 0.

## Ghi nhận

- Trang không có quyền trả mã HTTP 200 kèm nội dung 404: Next.js đã gửi bố cục (stream) trước khi trang gọi `notFound()`. Không lộ dữ liệu (HTML không chứa số liệu). Route xuất Excel trả 404 đúng mã.

## Không chặn nghiệm thu

- REV-04 chưa gồm COD đối soát (Phase 10).
- Nhóm đối chứng / Experiment (R-53 → Phase 12).
- Kỳ theo ngày UTC (cùng cách `/don-hang`); theo giờ Việt Nam để sau.

## Kết luận

Phase 9 **đạt toàn bộ tiêu chí nghiệm thu**.
