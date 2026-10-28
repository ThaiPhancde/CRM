---
name: nfr
description: Dùng khi cần audit + bổ khuyết Non-Functional Requirements của 1 feature — soát 8 nhóm NFR (hiệu năng/bảo mật/khả dụng/dễ dùng/mở rộng/bảo trì/tuân thủ/quan trắc), đảm bảo mỗi NFR có target đo được + kiểm được. Kích hoạt bằng `/nfr <feature>`.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion
user-invocable: true
argument-hint: "<feature-slug>"
---

# /nfr — Non-Functional Requirements Audit

## Goal

Soát **độ đầy đủ + chất lượng NFR** của 1 feature theo **8 nhóm chuẩn**, đảm bảo mỗi NFR áp dụng có **target đo được** + **cách kiểm được** — bắt NFR thiếu, mơ hồ ("nhanh", "an toàn"), hoặc không đo được. Hai chế độ trong 1: **audit** (soát NFR đã có trong `srs/{feature}-spec.md` Mục 3) + **elicit** (gợi ý NFR nhóm còn trống, hỏi target nếu chưa rõ).

Output: `docs/{feature}/{feature}-nfr-assessment.md` — bảng 8 nhóm với trạng thái (đủ/mơ hồ/thiếu/không áp dụng) + đề xuất NFR đo được + findings. NFR chốt được → đề xuất ghi vào `srs/{feature}-spec.md` Mục 3 (L2 diff, user duyệt).

## 8 nhóm NFR

| Nhóm | Hỏi gì | Ví dụ target đo được |
|---|---|---|
| **Performance** | Nhanh cỡ nào | Trả kết quả ≤ 2s ở p95; tải màn ≤ 1s |
| **Security** | Bảo vệ ra sao | Mã hóa dữ liệu nhạy cảm; khóa sau 5 lần sai; audit log truy cập |
| **Availability** | Sẵn sàng bao nhiêu | Uptime ≥ 99.5%/tháng; RTO ≤ 1h |
| **Usability** | Dễ dùng cỡ nào | Hoàn tất đặt đơn ≤ 3 bước; hỗ trợ tiếng Việt |
| **Scalability** | Chịu tải bao nhiêu | 500 đơn/phút giờ cao điểm không degrade |
| **Maintainability** | Dễ bảo trì | Tài liệu API; log đủ để trace lỗi |
| **Compliance** | Tuân thủ gì | PDPA/GDPR; hóa đơn điện tử theo quy định |
| **Observability** | Quan trắc gì | Alert khi tỷ lệ lỗi > 1%; dashboard đơn/giao |

## Constraints

- **Cần nguồn feature.** Ưu tiên `srs/{feature}-spec.md` (Mục 3 NFR + context). Chưa có spec nhưng có brainstorm/URD/PRD → vẫn audit được (elicit từ context) + note "chưa có SRS, nên chạy `/srs`". Không có gì → **refuse + route** (`feature-bootstrap.md`).
- **L1 approval** trước khi ghi assessment. **L2 diff** cho assessment và (nếu user duyệt) cho `spec.md` Mục 3.
- **Target đo được — cấm mơ hồ.** Mỗi NFR áp dụng phải có **con số/ngưỡng + cách kiểm**. "Nhanh"/"an toàn"/"ổn định" → flag mơ hồ, hỏi target cụ thể. **Số chưa chốt → OQ**, KHÔNG bịa (vd không tự đặt "99.99%" nếu nghiệp vụ chưa nói).
- **Chỉ nhóm áp dụng** — feature nhỏ không cần đủ 8 nhóm; nhóm không liên quan → đánh "không áp dụng" + lý do, KHÔNG ép nhồi.
- **Không sửa spec im lặng** — đề xuất NFR mới → L2 diff vào `spec.md` Mục 3, user duyệt mới ghi.
- **IT-BA framing** — NFR business-level (mục tiêu + ngưỡng đo được), KHÔNG kê giải pháp kỹ thuật ("dùng Redis"). Cách kiểm mô tả ở mức "đo p95 latency", không kê tool cụ thể trừ khi cần.
- **Doc sạch** (`ba-conventions.md` Mục 0). **Vietnamese-first**.

## Inputs

```
/nfr <feature>          # audit + elicit NFR cho feature
/nfr                    # list feature → chọn
```

## Context (dynamic)

Today: !`date +%Y-%m-%d`
Feature có spec: !`for d in docs/*/srs/*-spec.md; do [ -f "$d" ] && basename $(dirname $(dirname "$d")); done | tr '\n' ' '`

## Approach

### Phase A — Readiness + gather

1. **Resolve feature.** Không có spec lẫn brainstorm/URD/PRD → refuse + route `/srs`/`/brainstorm`.
2. **Read nguồn:** `srs/{feature}-spec.md` Mục 3 (NFR hiện có) + Mục 1/2 (context, FR gợi ý NFR liên quan), brainstorm/URD/PRD (rủi ro/kỳ vọng phi chức năng), `docs/_product/prd.md` Success Metrics (ràng buộc cấp sản phẩm). No-re-ask.

### Phase B — Audit 8 nhóm

3. Với mỗi nhóm NFR: xác định **có áp dụng không** (theo bản chất feature). Áp dụng → kiểm NFR hiện có: **đủ** (có target đo được + kiểm được), **mơ hồ** (có nhưng không đo được), **thiếu** (chưa có). Không áp dụng → note lý do.
4. **Elicit chỗ thiếu/mơ hồ:** hỏi user target cụ thể (1 batch gọn, chỉ nhóm áp dụng còn trống). Vague → re-ask 1 lần → vẫn vague → OQ. KHÔNG bịa số.

### Phase C — Compose + approval + write

5. **`{feature}-nfr-assessment.md`** (theo `_templates/nfr-assessment.md`):
   - `## Đánh giá 8 nhóm` — bảng `Nhóm | Áp dụng? | Trạng thái (đủ/mơ hồ/thiếu) | NFR hiện có | Target đo được đề xuất | Cách kiểm`.
   - `## Findings` — severity (BLOCKING: nhóm quan trọng với feature nhưng trống — vd payment thiếu security; WARNING: NFR mơ hồ; SUGGESTION: thêm quan trắc).
   - `## Đề xuất ghi vào SRS` — các NFR chốt được, format `NFR-{feature}-NNN`, sẵn để thêm vào `spec.md` Mục 3.
   - `## Open Questions` — target chưa chốt.
6. **L1 plan preview** → **Write assessment**. Nếu có NFR chốt được + user muốn → **L2 diff thêm vào `srs/{feature}-spec.md` Mục 3** (env note). 
7. **Phase D — Resolve OQ** (per `resolve-oqs.md`): target chưa chốt → loop resolve → cascade (assessment + spec) → L2 diff.
8. **Output report:**
   ```
   ✅ NFR assessment: docs/{feature}/{feature}-nfr-assessment.md
      Nhóm áp dụng: {a}/8 | Đủ {d} · Mơ hồ {m} · Thiếu {t} | Blocking {B} | OQ target: {q}

   Khắc phục: đề xuất {k} NFR đo được → ghi vào /srs {feature} Mục 3 (đã show diff).
   ```

## Gotchas

- **NFR mơ hồ = vô dụng** — "hệ thống phải nhanh" không kiểm được. Ép target: "≤2s p95". Đây là lỗi phổ biến nhất.
- **Bịa số** — uptime/latency/quota chưa có nguồn → OQ + đánh dấu "cần chốt", KHÔNG tự đặt "99.99%".
- **Ép đủ 8 nhóm** — feature nhỏ không cần hết; nhóm không áp dụng → note lý do, đừng nhồi.
- **Kê giải pháp kỹ thuật** — NFR nói *mục tiêu + ngưỡng*, không "dùng CDN/Redis"; giải pháp là việc dev/architect.
- **Sửa spec im lặng** — thêm NFR vào spec phải L2 diff, user duyệt.
- **Security cho feature nhạy cảm** — payment/auth thiếu nhóm Security là BLOCKING.
- **@author** — memory `user-identity`.

## References

- @../../rules/ba-conventions.md
- @../../rules/approval-gate.md
- @../../rules/naming-conventions.md
- @../../rules/feature-bootstrap.md
- @../../rules/resolve-oqs.md
- @../../rules/status-lifecycle.md
- @../../rules/changelog.md
- @../../rules/review-format.md
- @../../../_templates/nfr-assessment.md
- @./references/example-nfr.md
