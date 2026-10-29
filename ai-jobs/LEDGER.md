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
| 6 | 2026-10-29 | p4-sales `leads`: /nhu-cau danh sách + Kanban + Drawer tạo | 1 | gemini-4-argon-high, write | 398 s | checker 0, tsc 0 | 0 | 2: import module server ở client (500); hằng số từ file client sang trang server | 930 dòng |
| 7 | 2026-10-29 | p4-sales `lead-detail`: /nhu-cau/[id] | 1 | gemini-4-argon-high, write | 321 s | checker 0, tsc 0 | 0 | 2: khóa idempotency lệch hydration; nhãn tự động | 931 dòng |
| 8 | 2026-10-29 | p4-sales `queue`: /hang-doi | 1 | gemini-4-argon-high, write | 149 s | checker 0, tsc 0 | 0 | 0 sửa | 213 dòng |
| 9 | 2026-10-29 | p4-sales `tasks`: /nhiem-vu | 1 | gemini-4-argon-high, write | 231 s | checker 0, tsc 0 | 0 | 1: hằng số từ file client | 488 dòng |
| 10 | 2026-10-29 | p4-sales `content`: 60 lead + hội thoại vi/en/ar/de, 16 kịch bản | 1 | gemini-4-argon-high, write | 421 s | checker 0 (số lượng, phân bố giai đoạn, mã quốc gia, ngôn ngữ) | 0 | 0 sửa | 68 KB |
| 11 | 2026-10-29 | p5-service `tickets`: /cham-soc danh sách + Drawer tạo | 1 | gemini-4-argon-high, write | 270 s | checker 0, tsc 0 | 0 | 0 sửa | ~600 dòng |
| 12 | 2026-10-29 | p5-service `ticket-detail`: /cham-soc/[id] | 1 | gemini-4-argon-high, write | 263 s | checker 0, tsc 0 | 0 | 2: tự đặt tên enum sự kiện vận đơn (nhãn thô); tin khách mở ticket ghi "Hệ thống" | ~900 dòng |
| 13 | 2026-10-29 | p5-service `kb-list`: /tri-thuc | 1 | gemini-4-argon-high, write | 138 s | checker 0, tsc 0 | 0 | 0 sửa | ~250 dòng |
| 14 | 2026-10-29 | p5-service `kb-editor`: đọc/soạn/phiên bản/xuất bản | 1 | gemini-4-argon-high, write | 307 s | checker 0, tsc 0 | 0 | 0 sửa | ~800 dòng |
| 15 | 2026-10-29 | p5-service `content`: 20 bài tri thức + 30 ticket vi/en/ar/de | 1 | gemini-4-argon-high, write | 349 s | checker 0 (số lượng, phân bố, ngôn ngữ, không HTML) | 0 | 0 sửa | 62 KB |
| 16 | 2026-10-29 | p6-scoring `metrics-content`: 24 mã từ điển chỉ số | 1 | gemini-4-argon-high, write | 182 s | checker 0 (đúng tập mã, VND cho chỉ số tiền) | 0 | 0 sửa | JSON |
| 17 | 2026-10-29 | p6-scoring `formula-tests`: 68 ca bảng hàm điểm | 1 | gemini-4-argon-high, write | 270 s | checker 0; vitest 68/68 | 0 | 0 sửa (Claude tự tính lại từng ca: đúng) | 508 dòng |
| 18 | 2026-10-29 | p6-scoring `customer-scores`: thẻ điểm 360 + bảng R12M + cột hạng RFM | 1 | gemini-4-argon-high, write | 474 s | checker 0, tsc 0 | 0 | 0 sửa | ~430 dòng |
| 19 | 2026-10-29 | p6-scoring `lead-scores`: điểm ở danh sách/Kanban/chi tiết lead | 1 | gemini-4-argon-high, write | 317 s | checker 0, tsc 0 | 0 | 0 sửa | ~200 dòng |
| 20 | 2026-10-29 | p6-scoring `score-admin`: /quan-tri/diem + /quan-tri/chi-so | 1 | gemini-4-argon-high, write | 209 s | checker 0, tsc 0 | 0 | 0 sửa | ~350 dòng |

## Notes

5. Batch p6-scoring (5 job, 474 s; tỷ lệ 50/50 — D-51): cả 5 qua checker + tsc lần đầu, **0 lỗi review phía Gemini** — lần đầu từ p3. Khác biệt so với p5: work order liệt kê đúng enum/nhãn/tông màu và checker cấm tên hạng tự bịa. Bảng test hàm thuần là việc mới giao Gemini: Claude kiểm bằng cách tự tính lại từng kỳ vọng từ công thức (không chỉ chạy test) — đúng toàn bộ. Lỗi review lần này nằm ở phía Claude (bằng chứng điểm còn mã thô, số tiền chưa định dạng) — lộ ra khi Gemini hiển thị.

4. Batch p5-service (5 job song song, 349 s): cả 5 qua checker + tsc lần đầu, 0 ghi sai chỗ. Hai luật ranh giới client/server thêm sau p4 không bắt được lỗi nào lần này (Gemini đã theo đúng hướng dẫn mục 2). Lỗi mới: tự bịa giá trị enum khi work order không liệt kê (sự kiện vận đơn) — bài học: work order phải liệt kê đúng giá trị enum hoặc trỏ tới bảng nhãn dùng chung.

3. Batch p4-sales (5 job song song, 421 s, max-parallel 5): cả 5 qua checker + tsc lần đầu, 0 ghi sai chỗ. Review của Claude bắt 4 lỗi mà checker/tsc không thấy: client import `@/modules/sales/leads` kéo DB vào bundle (500 khi mở trang), trang server nhận `SOURCE_LABEL`/`STAGE_TONE`/`TASK_TYPE_LABEL` từ file `"use client"` (ra undefined, nhãn thô, mất màu), `useState(() => crypto.randomUUID())` lệch hydration, nhãn "Khách" cho dòng hệ thống. Đã thêm 2 luật ranh giới client/server vào checker (thử trên bản gốc: bắt 5 lỗi). Nội dung 60 lead ar/en/de/vi: tên hư cấu, không nhãn hiệu thật.

2. Batch p3-ui (4 job song song, 284 s wall clock, max-parallel 4): cả 4 qua checker + tsc ngay lần đầu, không ghi sai chỗ. Review của Claude bắt 3 lỗi bố cục/nội dung ở trang 360 (sửa tay) và 2 lỗi ở phía Claude lộ ra khi xem trang (lý do giao thất bại dạng mã thô trong service; menu "Cần xác minh" chỉ theo một quyền). Tỷ lệ Phase 3 theo dòng merge: Claude ~1.070 / Gemini ~1.300 (≈45/55) — vượt ngưỡng 50% do đếm dòng thiên về JSX; theo loại việc, Gemini chỉ làm giao diện + test bảng.

1. Batch 1: checker bắt hình dạng, trùng mã, giá khớp tỷ giá ±20%, tiếng Việt có dấu, tiếng Ả Rập cho LUMI/NOVA. Claude đọc toàn bộ 42 tên: không nhãn hiệu thật, không lời chữa bệnh; "Vitamin C 10%", "Hyaluronic" là tên thành phần, giữ. Ước tính "Claude tự làm" = viết 42 sản phẩm × 3 ngôn ngữ + giá 5 tiền tệ ≈ 9k token đầu ra; thực tế Claude tốn cho work order (~2k), checker (~2.5k), review (~1.5k). Lợi thế chính ở phần tiếng Ả Rập.
