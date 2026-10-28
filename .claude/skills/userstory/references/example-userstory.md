# Ví dụ chuẩn — User Story (INVEST)

> Mẫu output `/userstory` cho `food-delivery`. 2 file `us-{NNN}.md` (zero-frontmatter) + trích index. Học: vế "để" là **giá trị nghiệp vụ** (không lặp "tôi muốn"), Linked Requirements trỏ FR full-form, mục Acceptance Criteria để `/ac` điền (chỉ seed điều kiện chính).

---

## `userstories/us-001.md`

```markdown
# US-001: Đặt món từ menu nhà hàng

**Là** khách đang đói
**tôi muốn** chọn món từ menu và đặt đơn trong vài thao tác
**để** nhanh chóng có đồ ăn giao tới mà không phải gọi điện.

## Context
Khách đã đăng nhập, đang xem menu 1 nhà hàng đang mở cửa. Đơn phải đạt giá trị tối thiểu và mọi món còn hàng thì mới đặt được.

## Linked Requirements
- FR: [[../srs/food-delivery-spec.md#FR-food-delivery-001|FR-food-delivery-001]], [[../srs/food-delivery-spec.md#FR-food-delivery-002|FR-food-delivery-002]], [[../srs/food-delivery-spec.md#FR-food-delivery-003|FR-food-delivery-003]]
- BR: BR-food-delivery-001
- Use case: [[../usecases/uc-place-order.md|UC-place-order]]

## Acceptance Criteria
> Điều kiện chính: đặt thành công tạo đơn "Chờ nhà hàng xác nhận"; món hết hàng / dưới tối thiểu thì chặn. (Chi tiết Gherkin: xem `/ac`.)

## UI references
- Screens: menu, cart, order-tracking

## Error references
- E-food-delivery-001: nhà hàng đóng cửa
- E-food-delivery-002: món hết hàng
- E-food-delivery-003: đơn dưới tối thiểu

## Dependencies
- —

## Open Questions
- —
```

---

## `userstories/us-004.md`

```markdown
# US-004: Hủy đơn khi chưa được xác nhận

**Là** khách vừa đặt nhầm
**tôi muốn** hủy đơn khi nhà hàng chưa xác nhận
**để** không bị tính tiền cho đơn tôi không cần.

## Context
Chỉ hủy được khi đơn còn "Chờ nhà hàng xác nhận". Đơn đã thanh toán online thì hủy kéo theo hoàn tiền.

## Linked Requirements
- FR: [[../srs/food-delivery-spec.md#FR-food-delivery-008|FR-food-delivery-008]]
- BR: BR-food-delivery-002, BR-food-delivery-003
- Use case: [[../usecases/uc-cancel-order.md|UC-cancel-order]]

## Acceptance Criteria
> Điều kiện chính: hủy được ở "Chờ xác nhận"; đã xác nhận thì chặn; đã trả online thì tạo hoàn tiền. (Chi tiết: `/ac`.)

## UI references
- Screens: order-tracking, order-detail

## Error references
- E-food-delivery-005: hủy khi đã xác nhận

## Dependencies
- US-003 (theo dõi đơn) — cùng màn order-tracking

## Open Questions
- —
```

---

## Trích `food-delivery-story-index.md`

```markdown
| # | ID | Title | Persona | Covers FR | Screens | Priority | Status | Jira key | Updated |
|---|----|-------|---------|-----------|---------|----------|--------|----------|---------|
| 1 | [US-001](us-001.md) | Đặt món từ menu nhà hàng | Khách | FR-food-delivery-001..003 | menu, cart, order-tracking | P0 | draft | — | 2026-07-24 |
| 4 | [US-004](us-004.md) | Hủy đơn khi chưa xác nhận | Khách | FR-food-delivery-008 | order-tracking, order-detail | P1 | draft | — | 2026-07-24 |
```

**Vì sao mẫu này tốt:** (1) Vế "để" nêu giá trị ("không bị tính tiền", "nhanh có đồ ăn") — không lặp "tôi muốn". (2) Mỗi story map FR cụ thể; index cột Covers FR phủ hết FR (coverage). (3) Persona cụ thể theo ngữ cảnh, không generic "user". (4) AC chỉ seed — `/ac` mới viết Gherkin đầy đủ. (5) Dependency chéo được khai báo (US-004 phụ thuộc US-003).
