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
| 21 | 2026-11-02 | p7-marketing `campaigns-ui`: /chien-dich danh sách, form, chi tiết, điểm chạm, trạng thái | 1 | gemini-4-argon-high, write | 293 s | checker 0, tsc 0 | 0 | 1 sửa nhỏ: bảng 11 cột cuộn ngang → gộp Brand vào cột Kênh | ~760 dòng |
| 22 | 2026-11-02 | p7-marketing `message-templates`: 4 mẫu × vi/en/ar/de | 1 | gemini-4-argon-high, write | 90 s | checker 0 (16 mẫu, dòng STOP đúng từng ngôn ngữ) | 0 | 0 sửa | 16 mẫu |
| 23 | 2026-11-02 | p7-marketing `marketing-tests`: bảng test compileRules + nextSendable | 1 | gemini-4-argon-high, write | 292 s | checker 0; vitest 76 ca xanh | 0 | 3 ca Kolkata đổi kỳ vọng sau khi Claude sửa lỗi Gemini tự báo | ~270 dòng |
| 24 | 2026-11-02 | p8-ai `ai-admin-ui`: /ai 4 tab + /ai/[id], duyệt, ngân sách | 1 | gemini-4-argon-high, write | 361 s | checker 0, tsc 0 | 0 | 0 sửa (quyền theo tab đúng, Claude đọc cả 573 dòng) | ~800 dòng |
| 25 | 2026-11-02 | p8-ai `ai-lexicon`: từ điển + mẫu trả lời ar/de | 1 | gemini-4-argon-high, write | 171 s | checker 0 (giữ nguyên cụm cũ, mỗi danh sách có ar + de) | 0 | 0 sửa | 2 file JSON |
| 26 | 2026-11-02 | p8-ai `ai-tests`: bảng test parseSearch/parseAssistant/redact/costUsd | 1 | gemini-4-argon-high, write | 300 s | checker 0; vitest 52 ca xanh | 0 | 2 nghi vấn về code Claude, cả hai đúng → Claude sửa lõi + thêm 7 ca hồi quy | ~600 dòng |
| 27 | 2026-11-02 | p9-reports `report-sections`: báo cáo vận đơn + AI | 1 | gemini-4-argon-high, write | 164 s | checker 0, tsc 0 | 0 | 0 sửa (Claude đổi nhãn 'unknown' ở service) | ~250 dòng |
| 28 | 2026-11-02 | p9-reports `report-tests`: bảng test kỳ/tiền tệ/cohort | 1 | gemini-4-argon-high, write | 246 s | checker 0; vitest 56 ca xanh | 0 | 1 nghi vấn đúng (ngày không có thật được chấp nhận) → Claude sửa + 4 ca hồi quy | ~300 dòng |
| 29 | 2026-11-02 | p10-fulfillment `product-pages`: /san-pham danh sách + chi tiết | 1 | gemini-4-argon-high, write | 236 s | checker 0, tsc 0 | 0 | 0 sửa (dùng đúng contract, che tiền theo quyền) | ~560 dòng |
| 30 | 2026-11-02 | p10-fulfillment `p10-tests`: bảng test lý do/đọc bảng dán/bốn mốc COD | 1 | gemini-4-argon-high, write | 269 s | checker 0; vitest xanh | 0 | **4 nghi vấn đúng** (đếm dòng đối soát thay vì vận đơn, giây > 59, rowNo lệch khi có dòng trống đầu, "12,34,56") → Claude sửa + 7 ca hồi quy | ~390 dòng |
| 31 | 2026-11-02 | p11-admin `admin-pages`: /quan-tri/nhat-ky + /quan-tri/cau-hinh | 1 | gemini-4-argon-high, write | ~240 s | checker 0, tsc 0 | 0 | 0 sửa | ~970 dòng |
| 32 | 2026-11-02 | p11-admin `admin-tests`: bảng test schema cấu hình / nhật ký | 1 | gemini-4-argon-high, write | ~240 s | checker 0; vitest xanh | 0 | **3 nghi vấn đúng** (ngày không có thật lọt bộ lọc nhật ký, ô chỉ khoảng trắng thành 0, so JSON phụ thuộc thứ tự khóa) → Claude sửa + ca hồi quy | ~450 dòng |
| 33 | 2026-11-02 | p11-ux `confirm-modal`: ConfirmButton thay window.confirm (9 file) + tên truy cập nút lặp | 1 | gemini-4-argon-high, write | ~750 s | checker 0, tsc 0 | 0 | Claude nối prop ngữ cảnh ở trang gọi | ~200 dòng đổi |
| 34 | 2026-11-02 | p11-ux `copy-a11y`: thuật ngữ thống nhất, bỏ mã nội bộ, nav thay tab ARIA sai (27 file) | 1 | gemini-4-argon-high, write | ~750 s | checker 0, tsc 0; E2E cập nhật 1 thuật ngữ | 0 | 0 sửa | ~350 dòng đổi |

## Notes

10. Phase 11 (2 batch, 4 job): mọi job qua checker lần đầu, 0 ghi sai chỗ. Job test bảng lần thứ năm liên tiếp tìm ra lỗi thật (3 lỗi biên). Lượt chữ/a11y trên 36 file là việc hợp Gemini nhất: cơ học, nhiều file, checker kiểm được bằng regex chữ hiển thị.

9. Batch p10-fulfillment (2 job song song, 269 s; ~67/33 theo dòng): cả 2 qua checker + tsc lần đầu, 0 ghi sai chỗ. Lần thứ tư liên tiếp job test bảng tìm ra lỗi thật trong code Claude — lần này 4 lỗi biên (đếm mốc COD, giây, số dòng, nhóm nghìn). Giao Gemini đọc kỹ hàm thuần và liệt kê nghi vấn là việc đáng nhất của tỷ lệ 30%.

8. Batch p9-reports (2 job, 246 s; ~71/29 — về lại mục tiêu D-54 nhờ giao ít việc hơn p8): cả 2 qua checker + tsc lần đầu, 0 ghi sai chỗ, 0 lỗi review phía Gemini. Lần thứ ba liên tiếp job test bảng tìm ra lỗi thật trong code Claude (ngày không có thật). Gemini dựng phần báo cáo nhanh và đúng khi có sẵn khung + mẫu + hợp đồng chặt.

7. Batch p8-ai (3 job, 361 s; mục tiêu 70/30 nhưng thực tế ~48/52 theo dòng — vượt, như p3): cả 3 qua checker + tsc lần đầu, 0 ghi sai chỗ. Lần thứ hai liên tiếp job test bảng tự báo đúng 2 lỗi của Claude (tách từ bằng `\b` với chữ có dấu; khớp chuỗi con). Bài học: giao Gemini viết test cho hàm thuần là cách rà lỗi rẻ nhất — giữ quy tắc "test khớp code, liệt kê nghi vấn". Phần lớn lỗi Phase 8 nằm ở phía Claude và chỉ lộ khi xem trang (bài tri thức lạc đề, trích đoạn còn markdown, ngày ISO), không phải khi chạy test.

6. Batch p7-marketing (3 job, 293 s; tỷ lệ 70/30 — D-54): cả 3 qua checker + tsc lần đầu, 0 ghi sai chỗ. Điểm mới: job test bảng **tự báo 2 nghi vấn về code của Claude và cả hai đúng** (giờ yên lặng sai ở múi giờ lệch nửa giờ; trường lựa chọn nhận phép so sánh sai) — giữ quy tắc "test khớp code, liệt kê nghi vấn" ở work order là có giá trị. Lỗi review phía Gemini chỉ là bố cục (bảng quá rộng). Lỗi lớn nhất của đợt nằm ở phía Claude và lộ ra khi xem trang: trình dựng điều kiện thiếu phép "thuộc".

5. Batch p6-scoring (5 job, 474 s; tỷ lệ 50/50 — D-51): cả 5 qua checker + tsc lần đầu, **0 lỗi review phía Gemini** — lần đầu từ p3. Khác biệt so với p5: work order liệt kê đúng enum/nhãn/tông màu và checker cấm tên hạng tự bịa. Bảng test hàm thuần là việc mới giao Gemini: Claude kiểm bằng cách tự tính lại từng kỳ vọng từ công thức (không chỉ chạy test) — đúng toàn bộ. Lỗi review lần này nằm ở phía Claude (bằng chứng điểm còn mã thô, số tiền chưa định dạng) — lộ ra khi Gemini hiển thị.

4. Batch p5-service (5 job song song, 349 s): cả 5 qua checker + tsc lần đầu, 0 ghi sai chỗ. Hai luật ranh giới client/server thêm sau p4 không bắt được lỗi nào lần này (Gemini đã theo đúng hướng dẫn mục 2). Lỗi mới: tự bịa giá trị enum khi work order không liệt kê (sự kiện vận đơn) — bài học: work order phải liệt kê đúng giá trị enum hoặc trỏ tới bảng nhãn dùng chung.

3. Batch p4-sales (5 job song song, 421 s, max-parallel 5): cả 5 qua checker + tsc lần đầu, 0 ghi sai chỗ. Review của Claude bắt 4 lỗi mà checker/tsc không thấy: client import `@/modules/sales/leads` kéo DB vào bundle (500 khi mở trang), trang server nhận `SOURCE_LABEL`/`STAGE_TONE`/`TASK_TYPE_LABEL` từ file `"use client"` (ra undefined, nhãn thô, mất màu), `useState(() => crypto.randomUUID())` lệch hydration, nhãn "Khách" cho dòng hệ thống. Đã thêm 2 luật ranh giới client/server vào checker (thử trên bản gốc: bắt 5 lỗi). Nội dung 60 lead ar/en/de/vi: tên hư cấu, không nhãn hiệu thật.

2. Batch p3-ui (4 job song song, 284 s wall clock, max-parallel 4): cả 4 qua checker + tsc ngay lần đầu, không ghi sai chỗ. Review của Claude bắt 3 lỗi bố cục/nội dung ở trang 360 (sửa tay) và 2 lỗi ở phía Claude lộ ra khi xem trang (lý do giao thất bại dạng mã thô trong service; menu "Cần xác minh" chỉ theo một quyền). Tỷ lệ Phase 3 theo dòng merge: Claude ~1.070 / Gemini ~1.300 (≈45/55) — vượt ngưỡng 50% do đếm dòng thiên về JSX; theo loại việc, Gemini chỉ làm giao diện + test bảng.

1. Batch 1: checker bắt hình dạng, trùng mã, giá khớp tỷ giá ±20%, tiếng Việt có dấu, tiếng Ả Rập cho LUMI/NOVA. Claude đọc toàn bộ 42 tên: không nhãn hiệu thật, không lời chữa bệnh; "Vitamin C 10%", "Hyaluronic" là tên thành phần, giữ. Ước tính "Claude tự làm" = viết 42 sản phẩm × 3 ngôn ngữ + giá 5 tiền tệ ≈ 9k token đầu ra; thực tế Claude tốn cho work order (~2k), checker (~2.5k), review (~1.5k). Lợi thế chính ở phần tiếng Ả Rập.
