# Ví dụ chuẩn — /api-assess (đánh giá build-vs-buy / chọn nhà cung cấp)

> Mẫu `/api-assess food-delivery` cho nhu cầu **cổng thanh toán** (từ SRS Mục 7 External Interfaces, phục vụ FR-food-delivery-004). File `docs/food-delivery/integration/api-assess.md`. Học: tiêu chí NGHIỆP VỤ, số có nguồn, khuyến nghị có điều kiện, không thiên vị.

---

```markdown
## Bối cảnh & nhu cầu
Cần cổng thanh toán online cho FR-food-delivery-004 (khách trả online, chờ kết quả trước khi chuyển đơn cho nhà hàng). Ràng buộc: hỗ trợ hoàn tiền (BR-food-delivery-003), tuân thủ lưu trữ dữ liệu thẻ (NFR bảo mật).

## Scorecard
| Tiêu chí | Trọng số | PayGate | PayViet | Nguồn |
|---|---|---|---|---|
| Phí giao dịch | 25% | 1.8%/GD (8/10) | 2.2%/GD (6/10) | trang giá vendor |
| Độ phủ (COD+online+hoàn) | 25% | đủ (9/10) | đủ (9/10) | doc |
| SLA/tin cậy | 20% | 99.9% (9/10) | 99.5% (7/10) | trang SLA |
| Doc + sandbox | 15% | tốt (9/10) | trung bình (6/10) | thử sandbox |
| Tuân thủ PCI | 10% | PCI-DSS L1 (10/10) | L1 (10/10) | chứng chỉ |
| Khóa nhà cung cấp | 5% | chuẩn (7/10) | riêng (5/10) | doc |
| **Tổng** | | **8.6** | **7.1** | |

## Khuyến nghị
Chọn **PayGate** nếu ưu tiên chi phí + chất lượng doc/sandbox (tích hợp nhanh). Điểm yếu: khóa nhà cung cấp ở webhook format riêng. Chọn PayViet nếu đã có hợp đồng sẵn.

## Open Questions
- [ ] OQ-1: Phí hoàn tiền của PayGate — trang giá chưa nêu rõ.
```

---

**Vì sao mẫu này tốt:** (1) Nhu cầu **trace về FR-food-delivery-004 + BR-food-delivery-003** (không bịa nhu cầu). (2) Tiêu chí **nghiệp vụ** (phí/SLA/tuân thủ/lock-in) — không bàn SDK/code. (3) Số **có nguồn** (trang giá/SLA/chứng chỉ); phí hoàn chưa rõ → **OQ, không chế**. (4) Khuyến nghị **có điều kiện** + nêu **điểm yếu** của lựa chọn (không thiên vị). (5) So sánh cùng đơn vị ("táo với táo").
