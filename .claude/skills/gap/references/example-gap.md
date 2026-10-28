# Ví dụ chuẩn — /gap (Traceability & Gap)

> Mẫu output `/gap` cho vault có feature `food-delivery`. File `docs/_shared/traceability.md`. Học: ma trận cross-doc; mỗi FR 1 hàng (ô trống = gap); gap theo severity + route skill khắc phục; broken ref bắt cả short-form ID.

---

```markdown
## Coverage

| Feature | FR→UC | FR→US | US→AC | AC→Test | E→Test(neg) | Health |
|---|---|---|---|---|---|---|
| food-delivery | 4/9 | 7/9 | 7/7 | 6/7 | 5/6 | 78% |

## Ma trận truy vết

| FR | UC | US | AC | CHK/TC | Screen | Error | Trạng thái |
|---|---|---|---|---|---|---|---|
| FR-food-delivery-003 | UC-place-order | US-001 | AC-001..004 | CHK-001/TC-001 | cart | E-food-delivery-001..003 | testable |
| FR-food-delivery-006 | — | US-005 | AC | — | restaurant-order-queue | — | designed |
| FR-food-delivery-007 | — | US-006 | AC | — | shipper-task-list | — | designed |

## Gaps

### BLOCKING
- FR-food-delivery-006 (NH xác nhận) chưa có test → khắc phục: `/test-checklist food-delivery`
- FR-food-delivery-007 (shipper giao) chưa có UC + test → `/usecase food-delivery` + `/test-checklist`

### WARNING
- E-food-delivery-002 (món hết) có TC-004 nhưng chưa sinh E2E — chấp nhận (test tay).

## Broken references

| ID trỏ | Trong file | Vấn đề |
|---|---|---|
| — | — | (không có link gãy) |
```

---

**Vì sao mẫu này tốt:** (1) **Coverage %** mỗi tầng + health cho thấy ngay chỗ hở (FR→UC chỉ 4/9). (2) Ma trận **mỗi FR 1 hàng**, ô trống phơi bày gap (FR-006/007 không UC/test). (3) Gap theo **severity** + **route skill cụ thể** để khắc phục. (4) Read-only: `/gap` KHÔNG sửa spec, chỉ báo + chỉ đường. (5) Bắt cả **short-form ID** ở Broken references (nguồn "feature-ma"). (6) Kết luận dựa quan hệ **thật** đọc được, không bịa.
