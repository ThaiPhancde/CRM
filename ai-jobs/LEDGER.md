# Ledger — one row per batch

A rule moves from hypothesis to pillar only on the evidence recorded here. Write down how the
"Claude does it alone" estimate was made, in the Notes section below the table.

| # | Date | Kind of work | Jobs | Model, mode | Time | Validator (run by Claude) | Stray writes | Review defects | Claude tokens (actual / alone estimate) |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 2026-10-28 | p2-catalog: danh mục sản phẩm hư cấu vi/en/ar (42 sp, 67 SKU) | 1 | gemini-4-argon-medium, write | 152 s | checker exit 0 (runner `check` + Claude chạy lại) | 0 | 0 sửa | ~6k (work order + checker + review) / ~9k |
| 2 | 2026-10-29 | p3-ui `list`: trang /khach-hang | 1 | gemini-4-argon-high, write | 175 s | checker 0, tsc 0 | 0 | 0 sửa | 286 dòng |
| 3 | 2026-10-29 | p3-ui `profile`: hồ sơ 360 (6 tab, form quyền liên hệ, tách lại) | 1 | gemini-4-argon-high, write | 284 s | checker 0, tsc 0 | 0 | 3 sửa nhỏ: thẻ số liệu bị cắt ở 5 cột → 3/5 cột; giới hạn dòng thời gian 40 mục; "khách từ" dùng ngày mua đầu, ghi chú "không tính đơn hủy" | 611 dòng |
| 4 | 2026-10-29 | p3-ui `review`: tab Khách ở /xac-minh | 1 | gemini-4-argon-high, write | 260 s | checker 0, tsc 0 | 0 | 0 sửa (Claude bổ sung menu `anyPerm`, ngoài phạm vi job) | 135 + ~110 dòng |
| 5 | 2026-10-29 | p3-ui `phone`: bảng test chuẩn hóa SĐT 7 nước | 1 | gemini-4-argon-medium, write | 144 s | checker 0; vitest ~90 ca xanh | 0 | 0 sửa (Claude đối chiếu từng kỳ vọng với quy tắc) | 164 dòng |

## Notes

2. Batch p3-ui (4 job song song, 284 s wall clock, max-parallel 4): cả 4 qua checker + tsc ngay lần đầu, không ghi sai chỗ. Review của Claude bắt 3 lỗi bố cục/nội dung ở trang 360 (sửa tay) và 2 lỗi ở phía Claude lộ ra khi xem trang (lý do giao thất bại dạng mã thô trong service; menu "Cần xác minh" chỉ theo một quyền). Tỷ lệ Phase 3 theo dòng merge: Claude ~1.070 / Gemini ~1.300 (≈45/55) — vượt ngưỡng 50% do đếm dòng thiên về JSX; theo loại việc, Gemini chỉ làm giao diện + test bảng.

1. Batch 1: checker bắt hình dạng, trùng mã, giá khớp tỷ giá ±20%, tiếng Việt có dấu, tiếng Ả Rập cho LUMI/NOVA. Claude đọc toàn bộ 42 tên: không nhãn hiệu thật, không lời chữa bệnh; "Vitamin C 10%", "Hyaluronic" là tên thành phần, giữ. Ước tính "Claude tự làm" = viết 42 sản phẩm × 3 ngôn ngữ + giá 5 tiền tệ ≈ 9k token đầu ra; thực tế Claude tốn cho work order (~2k), checker (~2.5k), review (~1.5k). Lợi thế chính ở phần tiếng Ả Rập.
