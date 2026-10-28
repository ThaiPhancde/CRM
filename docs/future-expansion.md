# Nền tảng và lộ trình mở rộng (ngoài demo)

Cập nhật: 28/10/2026 (Phase 0). Nguồn: HLD §1.2, §10.2, §13, §14; D-00. Mục này ghi những gì demo **phải chừa chỗ** nhưng **không làm**, để khi lên thật không phải viết lại.

## 1. Yêu cầu nền tảng từng phase (demo phải giữ)

| Phase | Nền tảng phải có để mở rộng sau |
|---|---|
| 1 | `workspaceId` mọi bảng; `Role.permissions` là dữ liệu; `Setting` theo workspace; `IdentityProvider` interface |
| 2 | `ConnectorAdapter` có `capabilities()`; `SourceEvent` giữ `rawPayloadRef`; `Setting.sourceOfTruth` theo trường; `Outbox` kênh `POS_WRITEBACK` có enum sẵn, không dùng |
| 3 | `MergeLog` hai chiều; `ContactPreference` theo kênh/mục đích/brand |
| 6 | SQL chỉ số dialect-neutral; `Prediction` bảng có sẵn (trống); `ScoreVersion` |
| 7 | `Experiment` với `holdoutPct` (khung) |
| 8 | `LlmProvider` không gắn nhà cung cấp; `AiCost` theo tính năng/model |
| 9 | Báo cáo qua `Warehouse` duy nhất |

## 2. Lên thật (Phase 12)

Theo `demo-strategy.md` mục 5 và `deploy-checklist.md` (viết ở Phase 11.4): Pancake, Shopify, BigQuery, Anthropic, SMTP, SSO, Purchasing API, deploy, sao lưu lịch, giám sát.

## 3. Mở rộng nghiệp vụ sau demo

| Hướng | Điều kiện | Chạm gì |
|---|---|---|
| Ghi ngược POS (task/ghi chú/tag) | Q-12, quyền API, phê duyệt | Outbox `POS_WRITEBACK`, Approval |
| Inbox đa kênh (Pancake Inbox, Chatwoot) | Quyền hội thoại (Q-12) | Connector mới, `Activity` từ nguồn |
| Dự báo mua lại/rời bỏ (Prediction) | ≥ 6 tháng dữ liệu thật, baseline | Job huấn luyện ngoài CRM, ghi `Prediction`, đánh giá theo thời gian |
| Đề xuất sản phẩm | Dữ liệu dòng đơn + tồn | Tool AI + Warehouse |
| B2B Companies/Deals (ABC, EurroGO) | D-31: kiểm khả thi + mức cần thiết trước | Module mới, không đổi lõi |
| Nền tảng bán mới (website, sàn, nền tảng team khác đang dùng) | Q-10 khảo sát từng team | Đăng ký adapter + fixture + `linkRules`, không sửa nghiệp vụ (D-28) |
| Sàn TMĐT (Amazon…) | API/quyền nền tảng | Connector mới |
| Frequency cap xuyên brand | Chính sách công ty | `ContactCap` scope workspace → group |
| Địa phương hóa thêm ngôn ngữ UI | Q-33 | i18n chuỗi (demo chỉ vi) |
| Tuân thủ EU (xuất/xóa, lưu trữ) | Q-42 | `admin.export/erase` đã có khung |
| Hợp nhất tài chính đa pháp nhân | Ngoài CRM | Không làm ở đây (ERP-lite, `levelup-company-os/01` §3.2) |

## 4. Những gì cố tình không làm trong demo

- Không gọi API thật, không gửi gì ra ngoài.
- Không huấn luyện mô hình; `Prediction` trống.
- Không đa ngôn ngữ UI; chỉ nội dung gửi khách đa ngôn ngữ (replay).
- Không giờ làm việc theo market cho SLA (D-23).
- Không tính lợi nhuận nếu thiếu giá vốn (fixture một phần).
