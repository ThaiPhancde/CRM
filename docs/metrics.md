# Từ điển chỉ số CRM

Cập nhật: 28/10/2026 (Phase 0, bản gieo mầm). Nguồn: `D:\Work\levelup-company-os\06-tu-dien-chi-so.md` (quy ước REV/MKT/CM/OPS/INV/CASH, ba luật L1–L3), HLD §7, §9. Bảng `MetricDefinition` seed từ file này ở Phase 6. Định nghĩa là đề xuất theo từ điển LevelUp, chốt khi người dùng trả lời Q-20, Q-21.

## 1. Luật

- **L1** Cấm "doanh thu" trần. Mọi báo cáo, thẻ số liệu, câu trả lời AI ghi mã chỉ số.
- **L2** Chỉ số tiền nêu loại tiền và nguồn tỷ giá; hợp nhất về **VND** (D-44) theo `FxRate.rateToBase` tại `fxDate` của đơn; cột `netBase`.
- **L3** Bất đồng về số → Quản lý workspace chốt, cập nhật file này và `MetricDefinition`.

## 2. Nhóm REV — bốn mốc

| Mã | Tên | Định nghĩa | Thời điểm | Nguồn | Cạm bẫy |
|---|---|---|---|---|---|
| REV-01 | Giá trị đặt (Gross Booked) | Σ `Order.netAmount` của đơn `status ≠ CANCELLED` | `bookedAt` | Order | Gồm đơn sẽ hủy/hoàn; MKT hay dùng mốc này |
| REV-02 | Giá trị xác nhận | Σ đơn `status = CONFIRMED` | `confirmedAt` | Order | COD: xác nhận qua gọi; prepaid: thanh toán = xác nhận |
| REV-03 | Giá trị giao thành công | Σ dòng `qtyDelivered × unitPrice` − hoàn | `deliveredAt` (DeliveryEvent DELIVERED) | OrderItem, Refund | Giao một phần chỉ tính phần giao |
| REV-04 | Thực thu | Σ `Payment.amount` đã đối soát (`Settlement` với COD) − `Refund` | `remittedAt` | Payment, Settlement, Refund | COD trễ 30–60 ngày; đừng so cùng kỳ với REV-01 |

Tỷ lệ chuyển đổi mốc: REV-02/REV-01, REV-03/REV-02, REV-04/REV-03 — hiện ở dashboard Quản lý theo market.

## 3. Nhóm OPS, CASH

| Mã | Tên | Công thức | Nguồn |
|---|---|---|---|
| OPS-01 | Tỷ lệ giao thành công | đơn DELIVERED / đơn CONFIRMED (kỳ theo `confirmedAt`) | Order |
| OPS-02 | Tỷ lệ hoàn/thất bại | đơn FAILED+RETURNED / CONFIRMED | Order |
| OPS-03 | Thời gian giao TB | TB(`deliveredAt` − `confirmedAt`) ngày | Order |
| OPS-04 | Lý do thất bại top | đếm `Shipment.failureReason` | Shipment |
| CASH-01 | COD đã thu | Σ `Shipment.codAmount` có `collectedAt` | Shipment |
| CASH-02 | COD đã về | Σ `Settlement.amount` | Settlement |
| CASH-03 | COD đang kẹt | CASH-01 − CASH-02 theo carrier | — |

### 3.1. Bốn mốc COD ↔ mã chỉ số

REV-02 (xác nhận) không phải mốc COD; mốc "đã thu" chỉ có ở CASH-01.

| Mốc COD | Sự kiện | Mã chỉ số |
|---|---|---|
| booked | đặt | REV-01 |
| delivered | `DeliveryEvent` DELIVERED | REV-03 |
| collected | `DeliveryEvent` COD_COLLECTED, `collectedAt` | CASH-01 |
| remitted | `Settlement.remittedAt` | CASH-02 (số tiền COD), REV-04 (thực thu) |

## 4. Nhóm CUS — khách hàng

| Mã | Tên | Công thức | Ghi chú |
|---|---|---|---|
| CUS-01 | RFM | R = ngày từ lần mua hợp lệ cuối; F = số đơn hợp lệ 12 tháng; M = Σ REV-03 12 tháng VND; mỗi chiều chia 5 bậc theo ngũ phân vị trong workspace | "Hợp lệ" = REV-03 (Q-20) |
| CUS-02 | Chu kỳ mua lại | TB khoảng cách giữa các đơn hợp lệ của khách; < 2 đơn → TB brand | Dùng cho journey |
| CUS-03 | Mua lại 60 ngày | % khách có đơn hợp lệ thứ 2 trong 60 ngày sau đơn đầu, theo cohort tháng đầu | Cohort |
| CUS-04 | Giá trị đã tạo | Σ REV-03 − hoàn − chi phí có dữ liệu, trọn đời | Không phải CLV dự báo |
| CUS-05 | Rủi ro giao dịch | tỷ lệ từ chối nhận/không liên lạc trên đơn CONFIRMED của khách (lý do thuộc khách, Q-27) | Không tính lỗi vận chuyển |
| CUS-06 | Khách giá trị cao | ≥ 3 đơn hợp lệ 12 tháng (D-24) | Ngưỡng ở Cấu hình |

## 5. Điểm (Phase 6)

| Loại | Thành phần | Trọng số v1 | Dải |
|---|---|---|---|
| SALES_PRIORITY (lead) | Nhu cầu phù hợp / Tín hiệu mua rõ / Tương tác gần có tiến triển / Sẵn sàng đặt | 25/35/25/15 | 0–100, band Thấp <40, Vừa 40–69, Cao ≥70 |
| RFM | CUS-01 | — | 111–555, band Champions/Trung thành/Có nguy cơ/Ngủ đông/Mới |
| TXN_RISK | CUS-05, thông tin thiếu, địa chỉ chưa chuẩn | 60/20/20 | Thấp/Vừa/Cao; < 2 đơn → "chưa đủ dữ liệu" |
| SUPPORT_NEED | ticket mở, mức, thời gian chờ | 40/40/20 | Thấp/Vừa/Cao |

Mọi trọng số ở bảng trên là **giả thuyết v1** (D-33, HLD §7.2), chưa được kiểm chứng; UI ghi rõ phiên bản và không trình bày như chuẩn.

Mỗi `Score` ghi `reasons[]` (thành phần → điểm → bằng chứng), `missingData[]`, `suggestedAction` theo HLD §7.4.

## 6. Nhóm MKT, AI (demo)

| Mã | Tên | Công thức |
|---|---|---|
| MKT-01 | Lead theo nguồn | đếm Lead theo `source` |
| MKT-02 | Chi phí/lead | `Campaign.cost` / lead có touchpoint |
| MKT-03 | Tỷ lệ chuyển đổi lead | DA_MUA / tổng lead đóng |
| MKT-04 | Hoàn theo nguồn | OPS-02 cắt theo campaign |
| AI-01 | Lượt chạy, token, USD | AgentRun, AiCost |
| AI-02 | Tỷ lệ chấp nhận đề xuất | Suggestion ACCEPTED / tổng |
| AI-03 | Tỷ lệ từ chối quyền | ToolCall DENIED / tổng |
