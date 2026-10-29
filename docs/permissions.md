# Phân quyền

Cập nhật: 28/10/2026 (Phase 1). Nguồn: HLD §2 (quyền xuyên hệ thống), §8.4 (AI), D-21, D-34. Quyền là chuỗi `module.action`; ma trận vai trò × quyền nằm trong code `src/lib/permissions.ts` (vai trò cố định, không sửa trên giao diện — D-34). `requirePerm(user, perm)` dùng chung cho server action, route API, dịch vụ, tool AI, báo cáo, tìm kiếm.

**Đã có trong code (Phase 1):** `admin.users`, `admin.roles`, `admin.settings`, `admin.audit` (MANAGER); `catalog.view` (mọi vai); `finance.view` (MANAGER, SALES_LEAD, FINANCE_VIEW). Phase 2: `integration.manage/view`, `order.view/link`, `product.view`. Phase 3: `customer.view`, `customer.pii` (MANAGER, SALES_LEAD, SALES, FULFILLMENT — D-42), `customer.edit` (MANAGER, SALES_LEAD, SALES), `customer.merge` (MANAGER, SALES_LEAD). Che PII làm ở service qua `src/lib/pii.ts`. Phase 4: `lead.view` (MANAGER, SALES_LEAD, SALES, MARKETING), `lead.edit` (MANAGER, SALES_LEAD, SALES), `lead.assign` (MANAGER, SALES_LEAD), `task.manage` (MANAGER, SALES_LEAD, SALES, MARKETING, FULFILLMENT); phạm vi theo D-45 ở `src/modules/sales/scope.ts`. Phase 5: `ticket.view`/`ticket.edit` (MANAGER, SALES_LEAD, SALES, FULFILLMENT), `ticket.assign` (MANAGER, SALES_LEAD), `knowledge.view` (mọi vai), `knowledge.edit`/`knowledge.publish` (MANAGER, SALES_LEAD, MARKETING); phạm vi ticket theo D-50 ở `src/modules/service/scope.ts`. Phase 6: `score.config` (MANAGER) — đổi trọng số, tính lại; điểm khách xem theo `customer.view` + phạm vi khách, điểm lead theo `lead.view` + phạm vi lead; số tiền trong chỉ số/điểm che khi thiếu `finance.view`. Các quyền còn lại trong bảng mục 2 được thêm vào `permissions.ts` ở phase tương ứng.

## 1. Vai trò

| Mã | Tên | Phạm vi |
|---|---|---|
| GROUP_ADMIN | Quản trị công ty (LevelUp) | Mọi workspace = team (chuyển qua lại); trong team không có membership thì có quyền như Quản lý |
| MANAGER | Quản lý | Toàn workspace (team) |
| SALES_LEAD | Trưởng nhóm sales | Team của mình + xem toàn workspace |
| SALES | Sales/CSKH | Khách/lead/ticket được giao hoặc thuộc team |
| MARKETING | Marketing | Phân khúc, chiến dịch, hành trình; khách chỉ xem |
| FULFILLMENT | Vận đơn | Đơn, vận đơn, ticket giao hàng |
| PURCHASING_VIEW | Mua hàng (xem) | Sản phẩm, tồn, báo cáo sản phẩm |
| FINANCE_VIEW | Kế toán (xem tiền) | Báo cáo tài chính, COD, đối soát; không sửa |

## 2. Ma trận thao tác

✓ có · ◐ phạm vi hẹp (của mình/team) · — không

| Quyền | GROUP_ADMIN | MANAGER | SALES_LEAD | SALES | MARKETING | FULFILLMENT | PURCHASING_VIEW | FINANCE_VIEW |
|---|---|---|---|---|---|---|---|---|
| `workspace.switch` | ✓ | — | — | — | — | — | — | — |
| `admin.users`, `admin.roles`, `admin.settings` | ✓ | ✓ | — | — | — | — | — | — |
| `admin.audit` | ✓ | ✓ | — | — | — | — | — | ◐ tài chính |
| `admin.export`, `admin.erase` | ✓ | ✓ | — | — | — | — | — | — |
| `integration.manage` | ✓ | ✓ | — | — | — | — | — | — |
| `integration.view` | ✓ | ✓ | ✓ | — | ✓ | ✓ | — | — |
| `customer.view` | ✓ | ✓ | ✓ | ◐ | ✓ | ✓ | — | ✓ |
| `customer.pii` (SĐT/email đầy đủ) | ✓ | ✓ | ✓ | ◐ | — | ◐ | — | — |
| `customer.edit` | ✓ | ✓ | ✓ | ◐ | — | — | — | — |
| `customer.merge` | ✓ | ✓ | ✓ | — | — | — | — | — |
| `order.view` | ✓ | ✓ | ✓ | ◐ | ✓ | ✓ | ✓ | ✓ |
| `order.link` (gộp/tách đơn) | ✓ | ✓ | — | — | — | ✓ | — | — |
| `finance.view` (tiền, tỷ giá, COD) | ✓ | ✓ | ✓ | — | — | — | — | ✓ |
| `lead.view` / `lead.edit` | ✓ | ✓ | ✓ team | ◐ | ✓ xem | — | — | — |
| `lead.assign` | ✓ | ✓ | ✓ team | — | — | — | — | — |
| `task.manage` | ✓ | ✓ | ✓ team | ◐ | ◐ | ◐ | — | — |
| `ticket.view` / `ticket.edit` | ✓ | ✓ | ✓ | ◐ | — | ◐ giao hàng | — | — |
| `ticket.assign` | ✓ | ✓ | ✓ team | — | — | — | — | — |
| `knowledge.view` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `knowledge.edit` / `knowledge.publish` | ✓ | ✓ | ✓ | — | ✓ | — | — | — |
| `segment.manage`, `campaign.manage`, `journey.manage` | ✓ | ✓ | — | — | ✓ | — | — | — |
| `journey.activate` | ✓ | ✓ | — | — | — | — | — | — |
| `fulfillment.manage` | ✓ | ✓ | — | — | — | ✓ | — | — |
| `product.view` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `product.cost` (giá vốn) | ✓ | ✓ | — | — | — | — | ✓ | ✓ |
| `report.sales`, `report.customer` | ✓ | ✓ | ✓ | ◐ cá nhân | ✓ | — | — | ✓ |
| `report.marketing` | ✓ | ✓ | — | — | ✓ | — | — | ✓ |
| `report.fulfillment` | ✓ | ✓ | — | — | — | ✓ | — | ✓ |
| `report.finance` | ✓ | ✓ | — | — | — | — | — | ✓ |
| `report.ai` | ✓ | ✓ | — | — | — | — | — | — |
| `report.export` | ✓ | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ |
| `ai.run` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | — |
| `ai.approve` | ✓ | ✓ | ✓ team | — | — | — | — | — |
| `ai.budget` | ✓ | ✓ | — | — | — | — | — | — |
| `score.config` | ✓ | ✓ | — | — | — | — | — | — |

## 3. Phạm vi dữ liệu

- **Workspace:** mọi truy vấn gắn `workspaceId` ở lớp DB; GROUP_ADMIN chọn workspace đang làm việc, không bao giờ truy vấn chéo trong một request.
- **◐ của mình/team:** SALES thấy khách có lead/ticket/task gán cho mình hoặc team; SALES_LEAD thấy team. Lọc trong service `scopeFor(user)`, không ở UI.
- **Che trường:** thiếu `finance.view` → mọi số tiền trả `null` và UI hiện "—"; thiếu `customer.pii` → SĐT/email che giữa (`+971 5• ••• 123`).
- **AI:** tool chạy với quyền của người gọi; prompt chỉ chứa dữ liệu người đó được xem; kết quả tìm kiếm/báo cáo của AI lọc bằng cùng `scopeFor`.
- **Báo cáo:** truy vấn Warehouse thêm điều kiện workspace và phạm vi; FINANCE_VIEW không thấy PII.

## 4. Tác vụ AI cần duyệt (mặc định Q-32)

| Tool | Quyền | Duyệt |
|---|---|---|
| `tim_khach`, `tim_don`, `tom_tat_360`, `hoi_bao_cao` | theo `customer.view`/`order.view`/`report.*` | Không |
| `tao_nhiem_vu`, `tao_lich_hen` | `task.manage` | Không |
| `soan_phan_hoi` (chỉ soạn, lưu nháp) | `ticket.edit` hoặc `lead.edit` | Gửi đi cần người bấm; Outbox SIMULATED |
| Sửa hồ sơ khách/lead do AI đề xuất | `customer.edit` | Có — `Suggestion` → `Approval` |

## 5. Đăng nhập thử (demo)

`DEMO_LOGIN=true` hiện trang chọn 8 người mẫu (mỗi vai một người, GROUP_ADMIN có membership ở team PiAlpha và Team EU). Tắt mặc định. Session và quyền giống thật.
