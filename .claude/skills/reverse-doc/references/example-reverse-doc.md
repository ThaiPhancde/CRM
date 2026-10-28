# Ví dụ chuẩn — Reverse-doc (tái lập từ nguồn)

> Mẫu output `/reverse-doc` cho feature `loyalty-points` tái lập từ 1 đoạn spec cũ (docx). Files trong `docs/_reverse/loyalty-points/`. Học: KHÔNG phỏng vấn (nguồn = proof); nhãn tin cậy ✅/🔵/🟡; KHÔNG bịa (🟡/gap); ghi tách `_reverse/`; status draft cứng.

---

## Trích `loyalty-points-reverse-spec.md`

```markdown
## 2. Functional Requirements

| ID | Requirement | Nguồn | Nhãn |
|----|-------------|-------|------|
| **FR-loyalty-points-001** | Khách tích điểm theo giá trị đơn đã giao. | old-spec.docx §3.1 | ✅ |
| **FR-loyalty-points-002** | Điểm quy đổi thành voucher giảm giá. | old-spec.docx §3.2 | ✅ |
| **FR-loyalty-points-003** | Điểm hết hạn sau một thời gian. | old-spec.docx §3.4 (không nêu số) | 🟡 |

## Open Questions & Gaps
- [ ] 🟡 FR-003: nguồn nói "điểm hết hạn" nhưng KHÔNG nêu thời hạn cụ thể.
- [ ] ⚠️ Conflict: §3.1 nói "1.000đ = 1 điểm", §5 bảng ví dụ tính "10.000đ = 1 điểm".
```

## Trích `reverse-gaps.md`

```markdown
| Loại | Mục | Chi tiết | Cần |
|---|---|---|---|
| Gap 🟡 | FR-loyalty-points-003 | Thời hạn hết điểm không có trong nguồn | Xác nhận với nghiệp vụ |
| Conflict ⚠️ | Tỷ lệ quy đổi | §3.1 vs §5 lệch 10 lần | Chốt tỷ lệ đúng |
```

---

**Vì sao mẫu này tốt:** (1) **KHÔNG phỏng vấn** — mọi FR rút TỪ NGUỒN, cột **Nguồn** trỏ vị trí (`§3.1`). (2) **Nhãn tin cậy**: ✅ nguồn nói rõ, 🟡 nguồn không nêu số (FR-003 thời hạn) → KHÔNG bịa. (3) **Conflict** giữa 2 chỗ trong nguồn → giữ cả 2 + đánh dấu, để người chốt. (4) Ghi **tách** `docs/_reverse/loyalty-points/` — không đè doc chính thức. (5) **status draft cứng** — reverse cần người xác thực, không auto-approve.
