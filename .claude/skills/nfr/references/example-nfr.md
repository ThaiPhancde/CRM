# Ví dụ chuẩn — /nfr (NFR Assessment)

> Mẫu output `/nfr` cho `food-delivery`. File `docs/food-delivery/food-delivery-nfr-assessment.md`. Học: soát 8 nhóm; target **đo được** (không "nhanh"); số chưa chốt → OQ (không bịa); nhóm không áp dụng → note; đề xuất NFR sẵn ghi vào SRS Mục 3.

---

```markdown
## Đánh giá 8 nhóm

| Nhóm | Áp dụng? | Trạng thái | NFR hiện có | Target đo được đề xuất | Cách kiểm |
|---|---|---|---|---|---|
| Performance | có | mơ hồ | "cập nhật realtime" | Trạng thái đơn tới khách ≤ 5s p95 | đo p95 độ trễ đẩy trạng thái |
| Security | có | thiếu | — | Thanh toán qua cổng đạt chuẩn; không lưu thẻ; audit log giao dịch | rà log + pentest cổng |
| Availability | có | thiếu | — | Uptime ≥ 99.5%/tháng giờ phục vụ (10h–14h) | giám sát uptime |
| Usability | có | đủ | "hoàn tất đặt ≤ 3 bước" | (giữ) | đếm bước luồng đặt |
| Scalability | có | thiếu | — | 500 đơn/phút cao điểm trưa không degrade | load test giờ cao điểm |
| Maintainability | không | — | — | — | (feature nhỏ, chưa cần) |
| Compliance | có | thiếu | — | Hóa đơn điện tử theo quy định; PDPA dữ liệu khách | rà pháp lý |
| Observability | có | thiếu | — | Alert khi tỷ lệ đơn giao trễ > 10% | dashboard + alert |

## Findings

### BLOCKING
- **Security trống cho luồng thanh toán** — feature có payment nhưng chưa NFR bảo mật nào.

### WARNING
- **Performance mơ hồ** — "realtime" không đo được; cần ≤5s p95.

## Đề xuất ghi vào SRS (Mục 3)
- **NFR-food-delivery-001** — Trạng thái đơn cập nhật tới màn theo dõi ≤ 5s p95.
- **NFR-food-delivery-002** — Giao dịch thanh toán qua cổng đạt chuẩn, không lưu thông tin thẻ, có audit log.

## Open Questions
- [ ] OQ-1: Uptime target chính xác (99.5% hay cao hơn) + khung giờ phục vụ cam kết?
- [ ] OQ-2: Ngưỡng "đơn giao trễ" để alert là bao nhiêu %?
```

---

**Vì sao mẫu này tốt:** (1) **Target đo được** cho mỗi nhóm áp dụng ("≤5s p95", "500 đơn/phút") — bắt NFR mơ hồ "realtime". (2) **Không bịa số** — uptime/ngưỡng alert chưa chốt → OQ. (3) Nhóm **không áp dụng** (Maintainability) note lý do, không nhồi. (4) **Security trống cho payment = BLOCKING** (đúng mức độ). (5) NFR chốt được format `NFR-food-delivery-NNN` sẵn ghi vào spec (L2 diff). (6) Business-level, không kê giải pháp ("dùng Redis").
