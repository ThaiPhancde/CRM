---
type: uat-plan
feature: {{feature_slug}}
status: draft
updated: {{date}}
links:
  - docs/{{feature_slug}}/srs/{{feature_slug}}-spec.md
---

# {{feature_name}} — Kế hoạch nghiệm thu (UAT)

## 1. Phạm vi & mục tiêu

- **Feature:** {{feature_name}}
- **Người nghiệm thu:** {{vai trò / bộ phận}}
- **Môi trường:** {{staging / URL / tài khoản test}}
- **Mục tiêu:** {{xác nhận feature đáp ứng nhu cầu nghiệp vụ trước go-live}}

## 2. Entry criteria (điều kiện bắt đầu)

- [ ] {{build đã deploy lên môi trường UAT}}
- [ ] {{dữ liệu mẫu + tài khoản test sẵn sàng}}
- [ ] {{tài liệu spec/story đã approved}}

## 3. Exit criteria (điều kiện PASS để go-live)

- [ ] {{≥ X% kịch bản PASS}}
- [ ] {{0 lỗi mức blocking}}
- [ ] {{sign-off của {{vai trò}}}}

## 4. Kịch bản UAT

### UAT-001 — {{tên kịch bản}}
> Nguồn: {{AC-001 / FR-{{feature}}-003}}

- **Bối cảnh:** {{tình huống nghiệp vụ}}
- **Các bước:**
  1. {{hành động người dùng}}
  2. {{...}}
- **Kết quả mong đợi:** {{điều người dùng thấy}}
- **Kết quả:** ☐ PASS ☐ FAIL — {{ghi chú}}

### UAT-002 — {{tên kịch bản lỗi}}
> Nguồn: {{E-{{feature}}-004}}

- **Bối cảnh:** {{điều kiện gây lỗi}}
- **Các bước:**
  1. {{...}}
- **Kết quả mong đợi:** {{wording exact từ Error Matrix}}
- **Kết quả:** ☐ PASS ☐ FAIL — {{ghi chú}}

## 5. Bảng sign-off

| Người nghiệm thu | Vai trò | Kết luận | Ngày | Chữ ký |
|---|---|---|---|---|
| {{tên}} | {{vai trò}} | ☐ Chấp nhận ☐ Từ chối | | |

## 6. Defect log

| # | Kịch bản | Mô tả lỗi | Mức độ | Trạng thái |
|---|---|---|---|---|
| 1 | UAT-{{NNN}} | {{...}} | blocking/major/minor | mở/đã sửa |

## Open Questions

- [ ] OQ-1: {{...}}
