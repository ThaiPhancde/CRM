# Biên bản nghiệm thu Phase 10 — Vận đơn và sản phẩm

- **Ngày:** 02/11/2026
- **Yêu cầu:** người dùng yêu cầu làm tuần tự: xong Phase 9 nghiệm thu rồi mới làm Phase 10, xong Phase 10 nghiệm thu rồi mới sang Phase 11.
- **Người kiểm:** Claude, đối chiếu tiêu chí "Nghiệm thu" Phase 10 trong `Thiet_ke_CRM_va_prompt_Claude.md` mục 10 và quy tắc chịu tải D-48.
- **Phiếu ký chính thức:** thuộc người dùng và giám đốc (D-30).
- **Kết quả chung:**
  - `npx vitest run` → 17 file, **590 passed, 1 skipped** (ca bỏ qua là BigQuery thật).
  - `npx tsc --noEmit` sạch; `next build` thành công.
  - Đo tải 200k khách / 600k đơn / 600k vận đơn / 230k dòng đối soát: **74/75 đạt** (`docs/perf/phase10.json`).

| Tiêu chí | Bằng chứng | Kết quả |
|---|---|---|
| Một đơn COD đi qua 4 mốc hiện đúng ở **đơn** | Test: trước đối soát `booked/delivered/collected = done`, `remitted = pending`; sau → `done`, ngày về, số về, mã bảng. Trình duyệt: đơn LAE00308 (Aramex ARA00000308) 3/4 mốc → nhập bảng `ARX-2026-10-NT` qua form Đối soát (xem trước: "Về 233.50 AED, thiếu 1.5 so với COD 235") → trang đơn "Đã về (đối soát) · 30/10/2026 · 233,50 AED · Bảng ARX-2026-10-NT". | **Đạt** |
| … ở **khách** | Trình duyệt: hồ sơ khách (link mới từ trang đơn) → tab Đơn hàng cột COD "Đã về 30/10/2026"; dòng thời gian "COD đã về · LAE00308 · Bảng đối soát ARX-2026-10-NT". Test: CustomerMetric REV-04 = 160 × 7000 sau đối soát. | **Đạt** |
| … ở **báo cáo CASH** | Test: CASH-01 263 AED (2 vận đơn), CASH-02 160, CASH-03 100 (tuổi 16–30 ngày), REV-04 = 160 × 7000 theo ngày về, kỳ trước ngày về REV-04 = 0. Trình duyệt: báo cáo tài chính tháng 10 có bảng "COD theo hãng" (Aramex/SMSA, CASH-01/02/03, kẹt > 60 ngày), Excel thêm sheet "COD theo hãng"; `/van-don` tab COD theo hãng + tuổi + danh sách COD kẹt. | **Đạt** |
| Không cộng trùng / sai thứ tự | Dán lại cùng bảng → "Không đổi", 0 dòng mới; khác bảng → lỗi; chưa có mốc đã thu → lỗi; ngày về trước ngày thu → lỗi; trùng dòng trong bảng → lỗi; unique (đơn, mã vận đơn) ở DB. | **Đạt** |
| Lý do thất bại **không bị tính thành chất lượng khách** (trừ quy tắc rủi ro giao dịch có lý do thuộc khách) | Test cùng một khách: vận đơn thất bại vì `carrier_delay` → mọi chỉ số và điểm (RFM, rủi ro giao dịch, cần hỗ trợ) **giữ nguyên**; đổi thành `customer_refused` → `failedByCustomer` 0 → 1, chỉ điểm rủi ro giao dịch tăng, RFM và cần hỗ trợ giữ nguyên. Danh sách thuộc khách lấy từ một nguồn (`CUSTOMER_FAILURE_REASONS`). | **Đạt** |
| /van-don: cần can thiệp, lý do chuẩn hóa, giao lại/hủy/ticket | Test + trình duyệt (Vận đơn): xử lý giao lại đơn #1001 qua modal → Outbox `CARRIER` SIMULATED, đơn rời danh sách; bấm lại không nhân đôi; người thứ hai → 409; thất bại lại → hiện lại kèm "đã xử lý 1 lần trước"; hủy bắt buộc lý do; ticket gắn đơn + khách. | **Đạt** |
| /san-pham: Product/Variant chung, ánh xạ mã nguồn, giá vốn + tồn qua PurchasingLink, tồn thấp theo market | Test + trình duyệt (Quản lý): tồn AE/KW/SA/US, 20 biến thể × thị trường dưới ngưỡng, "Lấy giá vốn từ Mua hàng (14)" → 0 lệch; chi tiết sản phẩm có bán 90 ngày + mã nguồn theo kết nối; Vận đơn không thấy giá vốn; ánh xạ mã nguồn làm lại không đổi. | **Đạt** |
| Quyền | Sales: không có menu, `/van-don` 404; Kế toán: thấy tiền, không có nút xử lý / tab Đối soát, nhập đối soát → 403; Vận đơn: xử lý được, không thấy tiền; mọi hàm service có `requirePerm`. | **Đạt** |
| Chịu tải (D-48) | Can thiệp 284 ms (77k thất bại), tìm mã 14 ms, xử lý 7 ms, CASH 12 tháng 0,85 s, COD kẹt 174 ms, xem trước 500 dòng 62 ms, sản phẩm 153 ms. | **Đạt** (`/don-hang` theo ngày giao + REV-03 597 ms sát ngưỡng 500 — `performance.md`) |

## Lỗi tìm thấy khi nghiệm thu (đã sửa)

- Báo cáo qua Warehouse quá 15 s từ lần xem thứ 6 (kế hoạch chung của Postgres) — lỗi tiềm ẩn từ Phase 9; sửa ở `Warehouse.read`.
- Lead/ticket chưa có nhóm báo Quản lý của mọi workspace (lỗi cô lập từ Phase 4–5); sửa + test hồi quy.
- Form đối soát mất bảng đã dán sau Xem trước (React 19 tự xóa form) → ô nhập có kiểm soát.
- Tab Đối soát lỗi máy chủ (thiếu ngữ cảnh workspace) → `requirePerm` ở `codCarriers`.
- Trang đơn không có đường sang hồ sơ khách.

## Ghi nhận

- **Dữ liệu demo đã đổi:** thêm 102 bảng đối soát mẫu (584 vận đơn), bảng `ARX-2026-10-NT` (đơn LAE00308, nhập khi nghiệm thu), một yêu cầu giao lại (đơn #1001), giá vốn 14 biến thể theo Mua hàng.
- Mã vận đơn trong dữ liệu mẫu trùng giữa shop UAE và KSA (bộ sinh fixture đánh số theo shop); dòng đối soát nhận thêm cột `ma_don` khi mơ hồ — đúng với thực tế hãng có thể trùng mã giữa các nước.

## Không chặn nghiệm thu

- API Purchasing thật (Q-16), đối soát bằng file .xlsx, thông báo tồn thấp, ghi ngược POS/hãng (D-13, Phase 12).

## Kết luận

Phase 10 **đạt toàn bộ tiêu chí nghiệm thu**.
