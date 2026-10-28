# Ví dụ chuẩn — /rtg (Requirements Traceability Matrix)

> Mẫu output `/rtg` cho `food-delivery`. File `docs/_shared/rtg.md`. Học: 1 hàng/1 yêu cầu, **mọi FR đều có mặt** (kể cả chưa phủ — ô trống + đánh dấu); ID full-form; Status không lạc quan (chưa test pass thì tối đa `testable`); bảng phẳng xuất được.

---

```markdown
## RTM

| # | Requirement | Source | Use case | User story | AC | Test (CHK/TC) | Screen | Priority | Status |
|---|---|---|---|---|---|---|---|---|---|
| 1 | FR-food-delivery-003 | CAP-food-delivery-01 | UC-place-order | US-001 | AC-001..004 | CHK-001, TC-001 | cart | P0 | testable |
| 2 | FR-food-delivery-004 | CAP-food-delivery-01 | UC-make-payment | US-002 | AC-001..003 | CHK-005/006, TC-010/011 | checkout | P0 | testable |
| 3 | FR-food-delivery-006 | CAP-food-delivery-02 | — | US-005 | AC | — | restaurant-order-queue | P0 | designed |
| 4 | FR-food-delivery-007 | CAP-food-delivery-02 | — | US-006 | AC | — | shipper-task-list | P0 | designed |
| 5 | FR-food-delivery-009 | CAP-food-delivery-03 | — | US-007 | AC | — | review-form | P2 | designed |

## Chưa phủ

- FR-food-delivery-006: thiếu Use case + Test.
- FR-food-delivery-007: thiếu Use case + Test.
- FR-food-delivery-009: thiếu Use case + Test.

## Chú giải Status
- draft → designed (UC/US) → specified (AC) → testable (CHK/TC) → verified (test pass, cần kết quả).
```

---

**Vì sao mẫu này tốt:** (1) **Mọi FR có hàng**, kể cả FR-006/007/009 chưa có UC/test (ô `—` + liệt kê ở "Chưa phủ") — RTM **phơi bày chỗ hở**, không giấu. (2) ID **full-form** (`FR-food-delivery-003`) cho bàn giao cross-feature. (3) **Status không lạc quan**: chưa có kết quả test → tối đa `testable`, không `verified`. (4) Ô ngắn (list ID), giải thích để `/gap` — bảng phẳng **paste Excel/Confluence** được. (5) Chỉ liên kết **thật**, ô trống rõ ràng thay vì đoán.
