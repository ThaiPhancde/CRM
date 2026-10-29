# Trạng thái triển khai

Mới nhất ở trên. Mỗi mục: đã làm · test đã chạy (lệnh + kết quả thật) · còn thiếu/bị chặn · phần Claude / phần Gemini phụ trợ, tỷ lệ ước tính (mục tiêu ~60/40 từ Phase 3, D-27).

## Tổng quan

| Phase | Trạng thái | Ngày | Ghi chú |
|---|---|---|---|
| 0 Audit + đặc tả | **Xong bản nháp, chờ duyệt** | 28/10/2026 | Bộ tài liệu vai trò + thiết kế + prompt phase; chưa có code |
| 1 Nền tảng, quyền, UI shell | **Xong, chờ nghiệm thu** | 28/10/2026 | 22 test xanh; thử trình duyệt 2 vai; chưa commit/worktree |
| 2 Kết nối + đơn chuẩn | **Xong, chờ nghiệm thu** | 28/10/2026 | 32 test xanh; demo 1.963 đơn / 5 shop; Gemini 1 batch |
| 3 Customer 360 | **Đã nghiệm thu** (29/10, `docs/acceptance/phase-3-5.md`) | 29/10/2026 | 133 test xanh (sau D-44 tiền VND); 414 hồ sơ khách; Gemini 4 job (giao diện + test SĐT) |
| 4 Nhu cầu mua + sales | **Đã nghiệm thu** (29/10) | 29/10/2026 | 143 test xanh; 60 lead mẫu 4 ngôn ngữ; Gemini 5 job (4 trang + nội dung) |
| 5 Dịch vụ + tri thức | **Đã nghiệm thu** (29/10) | 29/10/2026 | 157 test xanh; 30 ticket + 20 bài tri thức 4 ngôn ngữ; đo tải 0/35 vượt |
| 6 Chỉ số + điểm + Warehouse | **Xong, chờ nghiệm thu** | 29/10/2026 | 230 test xanh; một khách tính tay khớp REV-01..04 + RFM; đo tải 0/41 vượt; Gemini 50% |
| 7 Journey + marketing | Chưa | | |
| 8 Trung tâm AI | Chưa | | |
| 9 Báo cáo + dashboard | Chưa | | |
| 10 Vận đơn + sản phẩm | Chưa | | |
| 11 Quản trị + rà soát UI + chạy thử | Chưa | | |
| 12 Lên thật | Ngoài demo | | |

## Phase 6 — đã làm (29/10/2026) — tỷ lệ Claude/Gemini 50/50 (D-51)

**Claude (lõi).**
- **Schema** (migration `phase6_metrics_scores`): `MetricDefinition`, `CustomerMetric`, `ScoreVersion`, `Score`, index đầy đủ.
- **Warehouse** `src/adapters/warehouse/`:
  - SQL chỉ số R12M viết một lần, sinh cho Postgres và BigQuery (`dialect`: bảng/cột, tham số `@x`, phép tính ngày, ép thời gian về UTC).
  - Postgres chạy thật bằng `INSERT … SELECT` trong giao dịch (`work_mem` 128MB); BigQuery là khung trả 501 có hướng dẫn (Phase 12).
- **Chấm điểm** `src/modules/scoring/`:
  - `formulas.ts` (hàm thuần): ưu tiên lead, RFM, rủi ro giao dịch, nhu cầu hỗ trợ (D-52).
  - `engine.ts`: dựng chỉ số + chấm khách theo khúc 5.000 ghi song song; lead mở chấm lại khi có tương tác mới.
  - `service.ts`: điểm theo quyền/phạm vi, che tiền; phiên bản trọng số (tổng 100, điểm cũ giữ, audit); "Tính lại ngay"; từ điển chỉ số.
- Quyền `score.config`; action `quan-tri/diem/actions.ts`; menu Điểm khách hàng + Từ điển chỉ số; điểm trong danh sách lead/Kanban/khách.
- Worker chạy `scoringJobs`: chỉ số + điểm khách hằng ngày (hoặc khi có phiên bản mới), lead mỗi lượt. Seed nạp `fixtures/metrics.json`.
- **Sửa khi đo:**
  - Lệch múi giờ 7 tiếng ở SQL thô (DB chạy múi giờ máy) → ép UTC.
  - Job hằng ngày 148 → 80 s.
  - Phạm vi đơn của Sales 579 → 321 ms (hợp 3 truy vấn có index).
  - Bằng chứng điểm còn mã thô (`CHO_QUYET_DINH`, số tiền chưa định dạng).

**Gemini (batch `p6-scoring`, 5 job song song, 474 s, cả 5 qua checker lần đầu, 0 ghi sai chỗ).**
- `fixtures/metrics.json`: 24 mã chỉ số, đúng tập mã trong `docs/metrics.md`.
- `tests/formulas.test.ts`: 68 ca bảng. **Claude tự tính lại từng ca:** rủi ro giao dịch, hỗ trợ, ưu tiên lead (kể cả trọng số tùy chỉnh) — đều đúng công thức.
- Thẻ điểm hồ sơ 360 + bảng chỉ số R12M có mã REV/CUS; cột "Hạng RFM" ở danh sách khách.
- Điểm lead: cột danh sách, huy hiệu trên thẻ Kanban, khối chi tiết.
- Trang `/quan-tri/diem` (phiên bản, form trọng số kiểm tổng 100 trực tiếp, Tính lại ngay) và `/quan-tri/chi-so`.
- Checker cấm tên hạng tự bịa: 0 vi phạm. Work order lần này liệt kê đúng giá trị enum/nhãn — không còn lỗi tự đặt tên như p5.

**Test (29/10):** `npx vitest run` → 9 file, **230 passed, 1 skipped**. Ca bỏ qua có chủ đích: chạy thử thật BigQuery chỉ chạy khi có khóa. Test Phase 6:
- **Một khách tính tay khớp** REV-01 740 / REV-02 740 / REV-03 480 / REV-04 580, hoàn 20, độ gần 35 ngày, chu kỳ 181,5 ngày, mua lại 60 ngày = không, từ chối do khách 1, lợi nhuận null (thiếu giá vốn), RFM 4-5-4.
- SQL BigQuery không còn cú pháp riêng Postgres; adapter BigQuery trả 501.
- Chưa đủ dữ liệu = null, không mặc định rủi ro.
- Đổi trọng số tạo v2, điểm v1 giữ; tổng ≠ 100 bị chặn; Marketing 403.
- Thiếu quyền tiền thì chỉ số tiền null, bằng chứng M bị che; khách ngoài phạm vi 404.
- Lead: tín hiệu mua 4 nhóm; chỉ chấm lại khi có tương tác mới.
- 68 ca bảng hàm thuần.

`tsc` sạch; `next build` thành công. **Đo tải 200k khách: 0/41 vượt mục tiêu** (`docs/perf/phase6.json`; job hằng ngày 80 s, điểm một khách 4 ms).

**Trình duyệt (Quản lý, 1600):**
- Danh sách khách có hạng "Khách tốt nhất".
- Hồ sơ 360: RFM 555, rủi ro 0, hỗ trợ 0 kèm lý do/phiên bản/gợi ý, bảng R12M.
- Danh sách lead có cột Điểm; chi tiết lead 87/100 kèm lý do.
- `/quan-tri/diem` "Tính lại ngay" → "Đã dựng chỉ số và chấm điểm 311 khách (0,3 giây)".

**Còn thiếu / để sau:**
- REV-04 chưa gồm COD đã đối soát (Settlement — Phase 10).
- Chạy thật BigQuery (Phase 12).
- Ý định mua dùng từ khóa — Phase 8 thay bằng LLM có bằng chứng.
- Q-20 (REV-03 hay REV-04 là giao dịch hợp lệ) còn mở.

**Tỷ lệ:** theo loại việc ~50/50 (Claude: Warehouse/SQL/công thức/engine/phiên bản/quyền/test tính tay/đo tải; Gemini: nội dung chỉ số, bảng test, toàn bộ giao diện điểm). Theo dòng: Claude ~1.050, Gemini ~1.500 + nội dung 24 mã.

## Phase 5 — đã làm (29/10/2026)

**Claude (lõi).**
- **Schema** (migration `phase5_service_knowledge`, `ticket_event_customer`): `Ticket`, `TicketEvent`, `SlaPolicy`, `KnowledgeArticle` + `KnowledgeVersion`, `Task.ticketId`. Index mọi khóa ngoại và trigram tiêu đề ngay từ đầu (quy tắc 11).
- **`src/modules/service/tickets.ts`:**
  - SLA mặc định theo mức (D-50) + chính sách theo brand; đổi mức tính lại hạn.
  - Tạo ticket idempotent: mã TK-xxxxxx theo team, cờ VIP (D-24), việc cho người phụ trách.
  - Danh sách/chi tiết theo phạm vi; chi tiết kèm đơn, vận đơn và bài tri thức gợi ý.
  - Trả lời khách → Outbox SIMULATED + ghi phản hồi đầu; ghi chú nội bộ.
  - Đổi trạng thái (giải quyết thì hoàn thành việc), đổi mức, chuyển phụ trách (chuyển cả việc).
  - Nhắc SLA sắp quá hạn/quá hạn mỗi thứ một lần, ghi theo lô.
  - Ticket vào hàng đợi: quá hạn → VIP → hạn.
- **`knowledge.ts`:** phiên bản chỉ thêm; người đọc chỉ thấy bản xuất bản; sửa bài đã xuất bản tạo nháp, xuất bản lại mới thay; lưu trữ; lọc brand/market/ngôn ngữ.
- **Phạm vi** `service/scope.ts` (D-50); khách có ticket giao cho Sales vào phạm vi của Sales đó.
- **Action** `cham-soc/actions.ts`, `tri-thuc/actions.ts`; worker thêm `remindTicketSla`; Customer 360 có ticket trên dòng thời gian.
- **Dữ liệu và đo tải:** `scripts/seed-service.ts` (hạn tính bằng `slaFor`, ticket quá hạn có sẵn coi như đã báo); seed SlaPolicy mẫu Lumi Cao 1h/6h; bộ sinh + bộ đo tải thêm 50k ticket.

**Gemini (batch `p5-service`, 5 job song song, 349 s, cả 5 qua checker lần đầu, 0 ghi sai chỗ).**
- Trang `/cham-soc` (danh sách + Drawer tạo) và `/cham-soc/[id]` (trả lời/ghi chú, dòng thời gian, trạng thái & mức, chuyển phụ trách, khách, đơn + vận đơn, việc, bài gợi ý).
- Trang `/tri-thuc`, `/tri-thuc/[id]` (đọc bài, chọn phiên bản, xuất bản/lưu trữ, sửa tạo phiên bản), `/tri-thuc/moi`. Markdown hiển thị bằng React, không chèn HTML.
- Nội dung `fixtures/knowledge.json` (20 bài vi/en/ar/de, 4 bài có bản sửa) và `fixtures/tickets.json` (30 ticket kèm hội thoại).
- **Claude review sửa 2 lỗi:**
  - Gemini tự đặt tên loại sự kiện vận đơn không có trong hệ thống (`PICKED_UP`, `LOST`…), nên `COD_COLLECTED` hiện thô — thay bằng `DELIVERY_EVENT` dùng chung.
  - Tin khách mở ticket ghi người gửi "Hệ thống".
- Claude bổ sung loại sự kiện "Khách nhắn" (thêm sau khi giao việc). Hai luật ranh giới client/server từ p4 đã chép vào checker p5: 0 vi phạm.

**Test (29/10):** `npx vitest run` → 7 file, **157/157 passed**. Phase 5 có 8 ca:
- hạn theo mức + theo brand + đổi mức tính lại hạn;
- tạo bấm hai lần (đồng thời) một bản + VIP + việc; Sales không tạo được cho khách ngoài phạm vi;
- phạm vi Sales/Vận đơn/Trưởng nhóm/Marketing/team khác;
- trả lời → phản hồi đầu + Outbox SIMULATED + gửi lặp không nhân đôi, ghi chú không tính;
- giải quyết hoàn thành việc, mở lại xóa mốc, chuyển phụ trách cần quyền;
- nhắc SLA một lần + hàng đợi quá hạn → VIP;
- tri thức nháp/xuất bản/bản sửa/lưu trữ; lọc brand/market/ngôn ngữ + gợi ý cho ticket.

`tsc` sạch; `next build` thành công. Đo tải với 50k ticket: **0/35 vượt mục tiêu** (`docs/perf/phase5.json`). `seed-service` chạy hai lần: lần hai tạo 0.

Trình duyệt (Trưởng nhóm, 1600):
- `/cham-soc`: 21 ticket, 6 quá hạn, cờ VIP.
- Chi tiết TK-000014 đủ khối; gửi trả lời → "giả lập — chưa gửi ra ngoài", dòng thời gian cập nhật.
- `/tri-thuc`: 14 bài, có "Có bản nháp mới"; bài v2 hiển thị cảnh báo khác bản xuất bản.

**Còn thiếu / để sau:** tạm dừng SLA khi "Chờ khách" và giờ làm việc theo thị trường (Phase 11 cấu hình); nút "Tạo ticket" từ trang đơn/khách (hiện nhập mã nội bộ); Q-23 chờ xác nhận số; E2E (Phase 11).

**Tỷ lệ theo dòng:** Claude ~1.150 dòng lõi + test + seed / Gemini ~2.550 dòng giao diện + 62 KB nội dung (giao diện và nội dung — D-27).

## Chịu tải dữ liệu lớn + luồng lead khối lượng lớn (29/10/2026, D-48, D-49)

**Vì sao:** người dùng yêu cầu kiểm hệ thống có chịu được dữ liệu lớn không, nếu không thì nâng cấp và sửa kế hoạch; và hỏi Kanban kéo thả có hợp lý với hàng trăm khách/ngày không (không hợp lý — xem D-49).

**Đo trước khi sửa (Claude, 100%).** `scripts/load/generate.ts` sinh 1 team/12 tháng vào DB riêng `crm_load` (602k đơn, 200k khách, 180k lead, 1,44M tương tác, 1,8M sự kiện giao — ~10 phút); `scripts/load/bench.ts` gọi đúng service của trang web với 3 vai. Kết quả trước: **8/27 vượt mục tiêu**, nặng nhất: nhập đơn 163 ms/bản ghi, tính giá trị khách 220 ms/khách, worker 7 s/lượt, tìm đơn 2,2 s, chi tiết đơn/hồ sơ 360 ~0,55 s.

**Nguyên nhân + sửa.**
- 21 khóa ngoại không có index (Prisma không tự tạo) → migration `scale_indexes` (25 index + trigram `pg_trgm` cho tìm kiếm) và `order_email_trgm`.
- Phạm vi đơn của Sales lọc qua quan hệ lồng → lấy danh sách khách trước rồi `IN`.
- Worker báo lại mọi lead quá hạn mỗi phút → `Lead.overdueNotifiedAt`, ghi theo lô.
- Worker thử giao lại khi nhóm đã hết chỗ → bỏ qua nhóm hết chỗ trong lượt.
- Thông báo "chưa giao được" từng lead → gộp theo giờ.

Kết quả sau: **0/28 vượt mục tiêu** (chi tiết đơn 569 → 7 ms; tìm đơn 2.177 → 11 ms; giá trị 100 khách 22 s → 0,25 s; worker 7,2 → 0,7 s; nhập đơn 6 → 46 bản ghi/s). Bảng đủ ở `docs/performance.md`.

**Luồng lead khối lượng lớn (D-49).**
- Chống lead trùng 7 ngày (ghi vào lead cũ, báo người phụ trách).
- `Lead.lastActivityAt`; tự đóng lead im lặng 14 ngày (`closeStaleLeads`, chạy trong worker).
- Đơn mới của khách → lead tự chuyển Đã mua (`closeLeadsOnOrder`, gọi trong nhập đơn).
- Thao tác hàng loạt `bulkLeads` + thanh chọn nhiều ở `/nhu-cau`.
- Kanban thành pipeline của một người: Sales mặc định của mình, người khác phải chọn người; giai đoạn đóng là ô thả + số đếm 30 ngày; cột vượt 50 thẻ có đường dẫn "còn N".

**Test:** `npx vitest run` → **149/149 passed** (thêm 6 ca: chống trùng + khác brand + quá 7 ngày; tự đóng + có hẹn thì không + mở lại không đóng ngay; đơn mới → Đã mua, đơn hủy thì không; thông báo gộp + quá hạn báo một lần; hàng loạt có lead ngoài phạm vi bị bỏ qua + cần quyền + cần lý do; Kanban giai đoạn đóng không tải thẻ). Migration áp lên `crm`, `crm_load`; `migrate diff` không lệch. Trình duyệt: Kanban của Sales mặc định "Của tôi" + ô thả; danh sách có thanh hàng loạt, áp dụng 2 lead thành công.

**Còn lại (ghi ở performance.md mục 5):** nhập đơn tuần tự (đổi theo lô khi > ~1M bản ghi/ngày/team); tổng REV-01 tính mỗi lần mở trang (Phase 6–9 dùng bảng chỉ số); chưa đo đồng thời nhiều người (Phase 11); trên DB thật cần `CREATE INDEX CONCURRENTLY`.

## Phase 4 — đã làm (29/10/2026)

**Rà Phase 2 trước khi làm (theo yêu cầu người dùng).** Đối chiếu lát 2.1–2.4 và mục nghiệm thu: 5 tình huống fixture, tính một lần, không lùi trạng thái, phát lại không tạo đơn — đều có test. Lệch thiết kế tìm thấy và sửa: quy tắc 3 yêu cầu ghi `NOT_OWNER` khi nguồn không làm chủ nhóm trường nào — trước đây ghi `APPLIED`; nay ghi `NOT_OWNER`, giữ mốc liên kết, không ghi vào đơn, cột "Không chủ" ở `/ket-noi` (migration `event_not_owner`, có test). Để lại có chủ ý: nút xác minh kết nối và test hợp đồng adapter thật (cần endpoint đã xác minh — Phase 12); bảng `Return` (dùng số hoàn theo dòng); màn ánh xạ SKU tay (Phase 10).

**Claude (lõi).** Schema `Lead`/`Assignment`/`Activity`/`Task`/`Script`/`Outbox`/`Notification` (migration `phase4_leads_tasks`). `src/modules/sales/`: `scope.ts` (phạm vi D-45, áp cả vào khách và đơn — Sales chỉ thấy khách/đơn có lead/việc của mình), `routing.ts` (phân công D-46: brand + market → nhóm, ít lead mở nhất, giới hạn 30, hàng chờ + báo), `leads.ts` (tạo idempotent, gắn khách khi SĐT khớp đúng một hồ sơ, danh sách/Kanban, chi tiết, đổi giai đoạn có lý do, ghi tương tác — liên hệ ra đầu tiên ghi đã phản hồi, chuyển phụ trách/nhận lead có lịch sử + audit), `tasks.ts` (tạo idempotent, phạm vi giao việc), `queue.ts` (hàng đợi ưu tiên quá hạn, thông báo, job worker giao lead treo + nhắc hạn → thông báo + Outbox SIMULATED), `labels.ts` (nhãn thuần dùng được ở client). Server action `nhu-cau/actions.ts`, `nhiem-vu/actions.ts`. Gộp/tách khách mang theo lead/việc/tương tác. Customer 360: tab Tương tác + nhu cầu mua, dòng thời gian có tương tác. Worker lặp 1 phút. Seed: `leadRouting` mỗi team, thêm "Đặng Sales" (PiAlpha) để thấy chia việc; `scripts/seed-sales.ts` nạp 60 lead qua đúng `autoAssign`.

**Gemini (batch `p4-sales`, 5 job song song, 421 s, cả 5 qua checker lần đầu, 0 ghi sai chỗ).** `/nhu-cau` (danh sách + Kanban kéo thả HTML5 + ô chọn thay bàn phím + Modal lý do + Drawer tạo lead), `/nhu-cau/[id]` (ghi tương tác, giai đoạn, việc, kịch bản, lịch sử phụ trách, chuyển phụ trách, nhận lead), `/hang-doi`, `/nhiem-vu`; `fixtures/leads.json` (60 lead, hội thoại vi/en/ar/de) + `fixtures/scripts.json` (16 kịch bản). **Claude review bắt 4 lỗi:** client import module server (lỗi 500 — tách `labels.ts`), trang server lấy hằng số từ file `"use client"` (nhãn nguồn/loại việc/màu giai đoạn ra rỗng), khóa idempotency sinh lúc render (lệch hydration), nhãn "Khách" cho dòng tự động. Thêm 2 luật vào checker để bắt hai lỗi đầu ở lô sau. Phía Claude tự sửa: thời gian dạng thô trong thông báo; hàm không gọi `requirePerm` thiếu `bindTenant`.

**Test (29/10):** `npx vitest run` → 6 file, **143/143 passed** (Phase 4: 9 ca — chia đều trong nhóm + hạn 4 giờ; quy tắc bắt tất cả + đủ tải → hàng chờ + báo + worker giao khi có chỗ; phạm vi Sales/Trưởng nhóm/Marketing/team khác + nhận lead; chuyển phụ trách cần quyền + phạm vi + lý do, lịch sử chỉ thêm; Sales chỉ thấy khách có lead của mình; liên hệ ra đầu tiên + Từ chối cần lý do + gửi lặp; tạo lead/việc cùng khóa, kể cả hai yêu cầu đồng thời, chỉ một bản; hàng đợi + nhắc một lần + Outbox SIMULATED; gộp/tách khách mang lead). `tsc` sạch; `next build` thành công. `seed-sales` chạy hai lần: lần hai tạo 0. Trình duyệt (1920): Quản lý — 38 lead PiAlpha, 6 quá hạn, Kanban đổi sang Từ chối bắt nhập lý do (server báo lỗi khi bỏ trống), trang chi tiết đủ khối; Sales — hàng đợi 10 việc/7 quá hạn, khách hàng 6 hồ sơ (trước đây 414), nhiệm vụ 2 việc.

**Còn thiếu / để sau:** E2E kéo thả tự động (Phase 11); phân công theo ngôn ngữ/năng lực cá nhân (chờ Q-22); chuông thông báo trên thanh trên cùng (thông báo đang ở `/hang-doi`); ticket trong hàng đợi (Phase 5). Q-22/Q-23 vẫn chờ người dùng xác nhận số.

**Tỷ lệ theo dòng:** Claude ~1.350 dòng lõi + sửa review / Gemini ~2.540 dòng giao diện + 68 KB nội dung; theo loại việc Gemini chỉ làm giao diện và nội dung (D-27).

## Đổi tiền quy đổi chung USD → VND (29/10/2026, D-44)

**Đã làm (Claude, 100%):** migration `20261029030000_base_currency_vnd` (đổi tên cột `rateToBase`/`netBase`/`valueBase12m`, nhân dữ liệu cũ × 26.300, thêm tỷ giá VND = 1, đổi khóa `amountDiffBase` trong hàng đợi nghi trùng); `src/lib/money.ts` (`BASE_CURRENCY`); `format.ts` hàm `base()` — VND 0 số lẻ; nhãn "quy VND" ở đơn hàng, chi tiết đơn ("1 USD = 26.300 VND"), khách hàng, danh mục tỷ giá, CSV, hàng đợi xác minh; giá vốn sản phẩm hiển thị theo nguyên tệ của nó; seed tỷ giá theo VND.

**Test:** `npx tsc --noEmit` sạch; `npx vitest run` → 5 file, **133/133 passed** (thêm 1 ca định dạng tiền; REV-01 = 102,6 × 26.300; REV-03 khách = 2.556.360; gift card 25 USD = 657.500); `next build` thành công; trình duyệt vai Quản lý: REV-01 1.883.309.452 ₫, đơn 32,95 US$ → 866.585 ₫, danh mục tỷ giá AED 7.161,227.

**Còn thiếu:** không. Tỷ giá AED/SAR trong DB demo cũ là 7.161,227 / 7.013,421 (quy từ số USD cũ); DB mới seed dùng 7.161,23 / 7.013,42.

## Phase 3 — đã làm (29/10/2026)

**Claude (lõi).** Schema `Customer` (kèm `valueUsd12m`, `orderCount`, `mergedIntoId`), `CustomerIdentity`, `Address`, `ContactPreference` (chỉ thêm dòng, giữ lịch sử), `CustomerReview`; `Order.customerId` (migration `phase3_customer360`, `phase3_customer_stats`). `src/lib/phone.ts` chuẩn hóa E.164 7 nước + che SĐT/email (D-41). `src/modules/customers/resolve.ts`: hợp nhất khi nhập đơn (gọi từ ingest) và chạy bù (`scripts/resolve-customers.ts`) — tự gộp theo mã khách nguồn hoặc SĐT; email chưa xác minh → hàng đợi; tên/IP không bao giờ là bằng chứng. `src/modules/customers/service.ts` (hợp đồng cho giao diện): danh sách lọc/sắp/phân trang, hồ sơ 360 + dòng thời gian hợp nhất, hàng đợi khách, gộp/tách có ảnh chụp danh sách id, ghi lựa chọn liên hệ. `src/lib/pii.ts` + che PII ở mọi dịch vụ đơn hàng (danh sách, chi tiết, CSV, hàng đợi đơn; chặn tìm theo SĐT/email khi thiếu quyền). Server action `src/app/(app)/khach-hang/actions.ts`. Worker tính lại giá trị 12 tháng cho hồ sơ cũ hơn 24 giờ. Menu `anyPerm` cho "Cần xác minh".

**Gemini (giao diện + test bảng, batch `ai-jobs/p3-ui`, 4 job song song, 284 s).** `/khach-hang` (lọc theo brand/thị trường/giá trị/lần mua gần nhất/khách mua lại, sắp xếp, ẩn lọc tiền khi thiếu quyền, gợi ý khi thiếu quyền PII), `/khach-hang/[id]` (5 thẻ tóm tắt, 6 tab: Tổng quan với dòng thời gian + quyền liên hệ + form ghi lựa chọn, Đơn hàng, Tương tác (Phase 4), Địa chỉ, Danh tính, Lịch sử gộp + Tách lại), tab Khách ở `/xac-minh` (kiểm cả `order.link` và `customer.merge`), `tests/phone.test.ts` (~90 ca). Claude đọc duyệt từng file, đối chiếu từng kỳ vọng test SĐT, sửa 3 chi tiết trang 360.

**Lỗi thật phát hiện và sửa:**
- **D-32 hiểu sai (D-40):** cấu hình "Pancake chủ nhóm giao hàng" của Team EU chặn luôn cập nhật giao hàng của đơn chỉ có ở Shopify → hầu hết đơn Orbi EU Store kẹt "Chưa giao". Sửa `ownedGroups` (chỉ giành quyền khi đơn có liên kết từ nền tảng chủ), thêm test, áp lại 400 bản ghi demo qua `scripts/reapply-latest.ts` → 339 đã giao / 28 thất bại / 12 hoàn.
- Trang đơn hàng Phase 2 trả SĐT/email đầy đủ cho mọi vai → che theo `customer.pii`.
- `fit()` chuẩn hóa SĐT giữ số 0 trung kế với số Việt Nam 10 chữ số → luôn bỏ tiền tố trung kế.

**Dữ liệu demo.** Chạy bù: 1.963 đơn → 414 hồ sơ khách (PiAlpha 307, Team EU 107). Thêm kịch bản 4 khách Mỹ đặt lại bằng SĐT + tài khoản Shopify mới cùng email → 4 cặp chờ xác minh.

**Test đã chạy (29/10):**
- `npx vitest run` → 5 file, **132/132 passed** (customers 7 ca lõi; phone ~90 ca; orders thêm ca D-40).
- `npx tsc --noEmit` sạch; `next build` OK; `npm run worker -- --once` exit 0.
- Trình duyệt (1440): danh sách khách Team EU; hồ sơ Inès Dubois (34 đơn, dòng thời gian, quyền liên hệ); `/xac-minh?tab=khach` Team PiAlpha 4 cặp → **gộp Ethan Taylor trên giao diện → 1 hồ sơ 18 đơn → Tách lại → 2 hồ sơ 17 + 1 đơn như cũ**. Vai Marketing: SĐT `+1 2••••••101`, email `et•••@…`, giá trị "—", tìm theo SĐT không ra, menu không có "Cần xác minh", gõ thẳng `/xac-minh` ra trang 404 (HTTP 200 do Next đã stream layout — cùng hành vi trang quản trị, không lộ dữ liệu).

**Chưa làm / còn hở:**
- Địa chỉ demo chỉ có quốc gia (nguồn phát lại chưa có địa chỉ chi tiết).
- Không có thao tác gộp thủ công hai hồ sơ ngoài hàng đợi (chỉ gộp từ yêu cầu xác minh).
- Một vài khách mẫu có rất nhiều đơn (34–66 đơn/năm) do phân phối sinh dữ liệu lệch — số liệu demo hơi cao so với thực tế.
- Tỷ lệ Phase 3 theo dòng code merge: **Claude ~45% / Gemini ~55%** (vượt ngưỡng 50%; Gemini chỉ làm giao diện + test bảng, đếm dòng thiên về JSX).

## Phase 2 — đã làm (28/10/2026)

**Lát 2.1 — khung connector.** Schema `Connection`, `SyncRun`, `SyncCheckpoint`, `SourceEvent` (migration `phase2_connectors_orders`). `src/adapters/connectors/`: kiểu `NormalizedOrder` (zod), registry theo mã nền tảng (D-28), mapper Pancake (định dạng phát lại giả định, CXM) và Shopify (Admin GraphQL giản lược, TL), nguồn phát lại đọc `fixtures/replay/<mã shop>.json`, nguồn live trả 501 có giải thích. Cấu hình kết nối mã hóa AES-256-GCM (`src/lib/crypto.ts`). `runSync`: khóa chống chạy chồng (409), checkpoint lùi 10 phút, thống kê từng lượt, đặt kết nối ERROR khi lượt thất bại. Chạy lại sự kiện lỗi.

**Lát 2.2 — đơn chuẩn.** `Product`/`Variant`/`SourceProductMapping`; `Order` (4 trạng thái tách, tiền Decimal nguyên tệ + tỷ giá chốt theo ngày đặt + USD), `OrderItem` (đặt/giao/hoàn theo dòng), `Payment`, `Refund`, `Shipment`, `DeliveryEvent`. `src/modules/orders/ingest.ts`: chống trùng theo eventKey, bản cũ đến muộn = STALE theo từng liên kết nguồn, chủ nhóm trường order/payment/fulfillment (D-32), thiếu tỷ giá = ERROR có lý do.

**Lát 2.3 — liên kết hai nguồn.** `SourceOrderLink`, `OrderLinkReview`, `MergeLog`, `Setting` (`linkRules`, `sourceOfTruth`). Tự liên kết khi đúng một đơn khớp quy tắc; nghi trùng → hàng đợi (D-37). Gộp có ảnh chụp, tách lại khôi phục đơn cũ cùng id.

**Lát 2.4 — giao diện + worker.** `/ket-noi` (thẻ kết nối, lượt đồng bộ, Đồng bộ ngay / Nạp lịch sử / Chạy lại lỗi / Tạm dừng, thêm kết nối), `/don-hang` (lọc GET, phân trang server 50/trang, ô REV-01 quy USD, lọc đơn nhiều nguồn, xuất CSV có BOM), `/don-hang/[id]` (dòng hàng, tổng tiền + tỷ giá chốt, dòng thời gian giao hàng, nguồn liên kết + trạng thái gốc, nhật ký bản ghi nguồn), `/xac-minh` (so cạnh nhau, gộp / không phải, tách lại), `/san-pham`. Worker `npm run worker` (`--once`). Quyền mới: `integration.manage/view`, `order.view/link`, `product.view`.

**Dữ liệu demo.** `npm run db:seed-demo`: 42 sản phẩm / 67 SKU (Gemini), sinh 8.288 bản ghi phát lại 12 tháng (tất định), nạp qua luồng đồng bộ thật → **1.963 đơn, 2.003 liên kết nguồn, 40 đơn Shopify–Pancake tự liên kết, 3 cặp chờ xác minh, 118 bản cũ đến muộn bị bỏ qua, 185 bản gửi lặp bị loại, 0 lỗi**.

**Test đã chạy (28/10):**
- `npx vitest run` → 3 file, **32/32 passed** (Phase 2: 10 ca — trùng hai nguồn tính một lần + REV-01 đúng 102,6 USD; DUPLICATE; STALE; giao/hoàn một phần; nghi trùng → gộp → tách lại; thiếu tỷ giá → ERROR → chạy lại; D-32 chủ nhóm giao hàng; nền tảng thứ ba chỉ cần đăng ký adapter; khóa đồng bộ chồng 409; che tiền + cô lập workspace).
- `npx tsc --noEmit` sạch; `next build` thành công (12 route); `npm run worker -- --once` exit 0.
- Trình duyệt (1440): `/don-hang` Team PiAlpha 1.350 đơn; đơn #6025 Team EU 2 nguồn, trạng thái giao lấy từ Pancake; `/xac-minh` 3 cặp; `/ket-noi` đồng bộ ngay → 1 trùng bỏ qua; CSV 200, `text/csv`, BOM EF BB BF.

**Lỗi thật phát hiện và sửa trong phase:** seed tỷ giá có hiệu lực từ 2026 trong khi dữ liệu bắt đầu 10/2025 → hệ thống từ chối quy đổi đúng thiết kế (288+ ERROR), sửa seed về 2025 rồi chạy lại lỗi thành công; bộ sinh dữ liệu đẩy "bản đến muộn" trùng phiên bản đã gửi nên chỉ ra DUPLICATE thay vì STALE — sửa để phiên bản đến muộn chỉ tới sau phiên bản mới hơn.

**Chưa làm / còn hở:**
- Gộp/tách trên trình duyệt chưa bấm thử (nút có hộp thoại xác nhận của trình duyệt); đã có test tự động.
- Sales thấy mọi đơn của team (chưa giới hạn theo khách được giao — Phase 4).
- SĐT so 9 chữ số cuối (Phase 3 thay bằng E.164).
- Webhook Shopify mô phỏng chưa làm (live chưa bật); `Settlement`/đối soát COD ở Phase 10.
- Tỷ lệ: Claude ~93% / Gemini ~7%.

## Phase 1 — đã làm (28/10/2026)

**Lát 1.0 — hai agent.** `git init` (main, chưa commit). `agy` 1.4.9 headless trả READY; model Gemini 4 Argon / 3.8 Flash có sẵn. Runner sửa 4 mục chặn + thêm test/mutant (`docs/antigravity-workflow.md` mục 7). Chưa tạo worktree vì repo chưa có commit.

**Lát 1.1 — schema + cô lập.** Prisma schema tổ chức (`prisma/schema.prisma`), migration `init_org`. `src/lib/db.ts`: `db` tự lọc/gán `workspaceId`, thiếu ngữ cảnh → lỗi; chặn ghi sang workspace khác kể cả tạo lồng; `runInWorkspace` tự await (lỗi thật phát hiện qua test: PrismaPromise trả ra ngoài chạy sau khi rời ngữ cảnh). `audit.ts`, `idempotency.ts` (dựa unique của DB, nhả khóa khi lỗi).

**Lát 1.2 — đăng nhập + quyền.** `session.ts` (JWT HS256 cookie httpOnly, chọn workspace, quản trị công ty mang MANAGER ở team không có membership), `permissions.ts` (vai trò cố định, D-34), `current-user.ts` (`pageUser` → 404 khi thiếu quyền). Đăng nhập thử kiểm `DEMO_LOGIN` ở server action. Google OIDC: chỉ có nút tắt khi có `GOOGLE_CLIENT_ID` — **chưa có route OIDC** (để Phase 12).

**Lát 1.3 — giao diện trắng–cam.** Token + Tailwind 4 theme, font Be Vietnam Pro; `AppShell` (sidebar 248/64px thu gọn nhớ lựa chọn, drawer menu ở < 1024px, topbar chọn team + menu người dùng); `Drawer`/`Modal` dùng `<dialog>` gốc + khóa một lớp phủ; `DataTable` (tìm, sắp, phân trang 25/50/100, rỗng/không khớp); form có lỗi inline và giữ giá trị vừa nhập khi lỗi; `loading.tsx` (skeleton), `error.tsx` (thử lại), 404. Trang: Tổng quan, Người dùng, Vai trò & quyền, Danh mục (brand/shop/thị trường/nhóm/tỷ giá), Nhật ký. Mục menu phase sau hiện mờ kèm nhãn P2…P10.

**Lát 1.4 — seed.** `npm run db:seed`: 2 team (PiAlpha, Team EU), 3 brand, 5 shop (pancake/shopify, hư cấu), thị trường US/DE/FR/AE/SA/KW, tỷ giá về USD, 9 người mẫu đủ vai. Chạy hai lần cho cùng kết quả.

**Test đã chạy (28/10):**
- `npx vitest run` → 2 file, **22/22 passed** (cô lập workspace 4, quyền 2, phiên 4, idempotency/audit 4, thành viên 3, danh mục 5).
- `npx tsc --noEmit` → sạch. `next build` → thành công, 8 route.
- `python -I tools/agy-runner/test_run_agy.py` → ALL PASSED, 15/15 mutant.
- Trình duyệt (Playwright, 1440/1920/768): chưa đăng nhập → `/dang-nhap`; Quản lý đăng nhập → Tổng quan; sửa shop gửi dữ liệu sai → lỗi inline đúng 3 ô, giữ giá trị vừa nhập; sửa đúng → drawer đóng, toast, bảng cập nhật; Sales gõ thẳng `/quan-tri/danh-muc` → 404; menu Sales ẩn mục quản trị; menu dạng drawer ở 768. Ảnh: `tests/e2e/shots/p1-*.png` (gitignore).

**Chưa làm / còn hở:**
- Chưa có E2E tự động kiểm "mở drawer rồi mở modal" — chưa trang nào dùng Modal; khóa một lớp phủ mới kiểm bằng đọc code. Làm ở Phase 11.2.
- Route Google OIDC chưa có (chỉ nút tắt).
- Chưa commit lần nào → chưa có worktree Gemini.
- Phase 1 tỷ lệ: Claude 100% / Gemini 0% (xem `antigravity-workflow.md` mục 7).

## Phase 0 — đã làm (28/10/2026)

- Cài BA-KIT 51 skill vào `.claude/` từ `D:\Work\SKILL BA\install.sh`.
- Viết `Thiet_ke_CRM_va_prompt_Claude.md`, `AGENTS.md`, `CLAUDE.md`, `docs/{decisions,requirements,questions-for-manager,architecture,data-model,permissions,system-flow-diagram,ui-design-system,demo-strategy,metrics,integrations,antigravity-workflow,implementation-status,handoff,future-expansion}.md`.
- Copy runner Gemini vào `tools/agy-runner/` (MIT), tạo `ai-jobs/`.
- Chưa: `git init`, kiểm `agy`, test runner, bất kỳ code nào.
- Test: không có.
- Bị chặn: người dùng duyệt D-01…D-27 và trả lời/giữ mặc định Q-xx.
