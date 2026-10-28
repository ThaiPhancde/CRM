# API Integration — rule chung cho họ 7 skill tích hợp

> Rule chung cho MỌI skill tích hợp API bên thứ 3: `/api-assess → /api-doc → /api-design → /api-map → /api-checklist → /api-test → /api-readiness`. Trả lời: **một IT-BA đặc tả tích hợp với dịch vụ ngoài (cổng thanh toán, SMS, map…) như thế nào cho đúng — mà KHÔNG lấn sang code, KHÔNG bịa contract, KHÔNG lộ secret?** Mọi skill họ này MUST reference file này trong Constraints + References.

## 0. Nguyên tắc tối cao

1. **Endpoint/contract đến TỪ tài liệu nhà cung cấp (proof), KHÔNG bịa.** Đây là ngoại lệ có kiểm soát của `ba-conventions.md` Mục 3 (cấm hỏi endpoint/payload): với tích hợp, contract của bên thứ 3 là **dữ kiện ngoài** BA phải nắm — nhưng chỉ **ghi lại từ nguồn thật** (doc vendor/OpenAPI/Postman), KHÔNG suy diễn field/endpoint không có trong nguồn. Thiếu → **OQ**, không chế.
2. **BA đặc tả HÀNH VI tích hợp, không viết code.** Trọng tâm: *khi nào gọi, gọi để làm gì (nghiệp vụ), map trạng thái ra sao, lỗi thì sao, đối soát thế nào, UX suy giảm khi dịch vụ ngoài chết*. KHÔNG quyết SDK/thư viện/ngôn ngữ — đó là dev.
3. **KHÔNG lộ secret.** API key/token/secret **đọc từ env**, KHÔNG viết vào doc/test/example. Ví dụ dùng `{{apiKey}}` / `process.env`.
4. **Không false-pass.** Test sinh ra mà chưa map đủ (thiếu URL thật/giá trị) → đánh **skipped/@todo**, KHÔNG để test "xanh giả".

## 1. Họ 7 skill — luồng & vai trò

| Bước | Skill | Làm gì | Output (`naming-conventions.md`) |
|---|---|---|---|
| [0]* | `/api-assess` | Đánh giá build-vs-buy / chọn nhà cung cấp (scorecard nghiệp vụ: chi phí, độ phủ, tin cậy, chất lượng doc, tuân thủ) | `integration/api-assess.md` |
| [1] | `/api-doc` | Đọc & tóm tắt **contract** bên thứ 3 thành bản BA đọc được (operation, auth mức cao, rate limit, error semantics) | `integration/api-summary.md` |
| [2] | `/api-design` | **Integration Blueprint**: orchestration, state-map (trạng thái ta ↔ họ), source-of-truth, webhook vs polling, retry, reconciliation, degraded-UX | `integration/api-design.md` |
| [2b] | `/api-map` | Field mapping 3 tầng (field ta ↔ field họ ↔ transform) — hội tụ dưới api-design | `integration/api-map.md` |
| [3] | `/api-checklist` | Test outline: cột `test_layer`(own/3rd/mixed) + `direction`(out/in) | `test/api/api-checklist.md` |
| [4] | `/api-test` | Bộ test **Bruno** (chạy được) sinh từ plan qua engine | `test/api/api-tests.md` + `bruno/` |
| [5] | `/api-readiness` | Go-live gate: cutover/flag/monitoring/rollback/SLA-deprecation + bảng go/no-go | `integration/api-readiness.md` |

\* [0] có điều kiện — chỉ khi cần chọn nhà cung cấp. Đã chốt vendor → bỏ qua, vào `/api-doc`.

> File tên-cố-định trong `integration/` + `test/api/` dùng **bare name** (không prefix `{feature}-`) — folder đã phân biệt đủ. Nhiều nhà cung cấp → `api-summary-{provider}.md`.

## 2. Hai khái niệm phân tầng (dùng xuyên suốt checklist/test)

- **test_layer** — tầng chịu trách nhiệm: **own** (logic phía ta, vd map trạng thái, validate trước khi gọi) · **3rd** (hành vi dịch vụ ngoài, vd cổng trả mã lỗi gì) · **mixed** (luồng end-to-end xuyên cả hai).
- **direction** — chiều gọi: **out** (ta gọi họ — request/response) · **in** (họ gọi ta — webhook/callback). Webhook `in` cần đặc tả: xác thực nguồn, idempotency (nhận trùng), thứ tự tới trễ.

## 3. Bảy trụ cột của Integration Blueprint (`/api-design`)

1. **Orchestration** — gọi API nào, khi nào, theo thứ tự gì trong luồng nghiệp vụ.
2. **State mapping** — trạng thái nghiệp vụ của ta ↔ trạng thái/mã của họ (vd Order "Chờ thanh toán" ↔ gateway `PENDING`).
3. **Source of truth** — ai là chân lý cho từng dữ liệu (số tiền: ta; kết quả giao dịch: họ).
4. **Webhook vs polling** — nhận kết quả bất đồng bộ kiểu nào; nếu cả hai → thứ tự ưu tiên + chống trùng.
5. **Retry & timeout** — gọi lại khi nào, mấy lần, backoff; timeout bao lâu coi là thất bại (số chưa chốt → OQ).
6. **Reconciliation** — đối soát khi ta & họ lệch (job rà, truy vấn trạng thái, xử lý mồ côi).
7. **Degraded UX** — dịch vụ ngoài chậm/chết thì user thấy gì, có fallback nghiệp vụ không (vd cổng lỗi → cho chọn COD).

## 4. Idempotency & an toàn tiền/đơn

- Thao tác tạo giao dịch/đơn phải **idempotent** (khóa idempotency) — gọi lại không tạo trùng.
- Webhook `in` phải chịu được **nhận trùng** + **tới trễ/không thứ tự**.
- Tuyệt đối KHÔNG coi "gọi API thành công" = "nghiệp vụ hoàn tất" nếu chưa có xác nhận trạng thái cuối.

## 5. Engine Bruno (`/api-test`) — hợp đồng

> Giống engine `playwright-gen.mjs` của bộ test: **thuần Node ESM, không cần `node_modules` để chạy**, sinh **deterministic** từ plan.

- Nguồn: `plan.json` (list request: name/method/url-template/headers/body/assert + layer/direction) + `vars.json` (biến môi trường, KHÔNG chứa secret thật — dùng placeholder `{{...}}`).
- Sinh: collection Bruno (`bruno.json` + `*.bru` + `environments/*.bru`) trong `test/api/bruno/`.
- **Request chưa map đủ** (thiếu URL thật / giá trị bắt buộc / assert) → sinh `.bru` đánh dấu **skipped + `@todo`** (KHÔNG assert xanh giả). Giống `test.fixme()`.
- **Idempotent**: chạy lại cùng plan → cùng output (không phá sửa tay ngoài vùng gen — cảnh báo nếu phát hiện).
- Chạy: `node .claude/scripts/api-test-gen.mjs --dir docs/{feature}/test/api`. In summary `APIGEN-OK: requests=N bru=N todo=M`.

## 6. Secret & môi trường

- Secret (key/token) chỉ ở env; `environments/*.bru` dùng `{{apiKey}}` trỏ env, KHÔNG hardcode.
- Base URL sandbox vs production tách môi trường; go-live (`/api-readiness`) kiểm đã trỏ đúng env production + secret production sẵn sàng.

## 7. Activity log

Set env trước mỗi Write (hook ghi `docs/_shared/activity.log`):
```
{date} | /api-design | @author | docs/{feature}/integration/api-design.md | blueprint: 6 call, state-map order↔payment, webhook in
{date} | /api-test | @author | docs/{feature}/test/api/ | APIGEN: 9 request, 2 todo (chưa có URL sandbox)
```

## Anti-patterns

- ❌ Bịa endpoint/field không có trong doc vendor → tích hợp sai, nguy hiểm (tiền/đơn).
- ❌ Hỏi BA "endpoint là gì, payload ra sao" như thể BA tự nghĩ — phải lấy từ nguồn vendor; thiếu → OQ.
- ❌ Hardcode API key/token vào doc/test/example.
- ❌ Coi API 200 = nghiệp vụ xong (bỏ qua xác nhận trạng thái cuối / webhook).
- ❌ Test xanh giả khi chưa có URL/giá trị thật (phải skipped/@todo).
- ❌ Bỏ qua degraded-UX/reconciliation → khi vendor chết, nghiệp vụ kẹt không lối thoát.
- ❌ Lấn vai dev: chọn SDK/thư viện/ngôn ngữ, thiết kế schema DB nội bộ.

## Tóm tắt 1 dòng

> **7 skill assess→doc→design→map→checklist→test→readiness · contract từ vendor doc (không bịa) · BA đặc tả hành vi tích hợp (orchestration/state/webhook/retry/reconcile/degraded-UX) · test_layer own/3rd/mixed × direction out/in · Bruno engine deterministic, chưa map → @todo · secret ở env.**
