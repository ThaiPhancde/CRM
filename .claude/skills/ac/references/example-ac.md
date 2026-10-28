# Ví dụ chuẩn — Acceptance Criteria (Gherkin)

> Mẫu output `/ac`: mục `## Acceptance Criteria` được ghi **inline vào chính** `us-001.md` (feature `food-delivery`). Học: phủ đủ happy / negative (mỗi `E-*`) / business rule; mỗi Then **đo được** (trạng thái + wording exact + số liệu); mỗi AC trỏ nguồn FR/BR/E.

---

## Mục `## Acceptance Criteria` sau khi `/ac` điền (trong `us-001.md`)

```markdown
## Acceptance Criteria

**AC-001** — Đặt đơn thành công (FR-food-delivery-003)
Given khách đã đăng nhập, nhà hàng đang mở cửa, giỏ có ≥1 món còn bán và tổng đơn ≥ 30.000đ
When khách bấm "Đặt đơn"
Then hệ thống tạo đơn ở trạng thái "Chờ nhà hàng xác nhận"
And khách được chuyển sang màn theo dõi đơn kèm mã đơn

**AC-002** — Nhà hàng đóng cửa (E-food-delivery-001)
Given nhà hàng chuyển sang đóng cửa trước khi khách đặt
When khách bấm "Đặt đơn"
Then hiện thông báo "Nhà hàng hiện đang đóng cửa, vui lòng chọn nhà hàng khác."
And đơn KHÔNG được tạo

**AC-003** — Món hết hàng (E-food-delivery-002)
Given giỏ hàng có 1 món vừa hết hàng
When khách bấm "Đặt đơn"
Then hiện thông báo "Món {tên} đã hết, vui lòng cập nhật giỏ hàng."
And đơn KHÔNG được tạo
And giỏ hàng được giữ nguyên để khách sửa

**AC-004** — Dưới giá trị tối thiểu (BR-food-delivery-001 / E-food-delivery-003)
Given tổng đơn < 30.000đ
When khách xem giỏ hàng
Then nút "Đặt đơn" bị vô hiệu hoá
And hiện dòng "Đơn tối thiểu 30.000đ."
```

---

**Vì sao mẫu này tốt:**
- **Phủ 3 loại:** AC-001 happy path; AC-002/003 negative (mỗi error code 1 AC, wording khớp Error Matrix exact); AC-004 business rule biên (đúng ngưỡng 30.000đ trong BR).
- **Then đo được:** trạng thái cụ thể ("Chờ nhà hàng xác nhận"), wording exact (trong ngoặc kép đúng Error Matrix), hành vi UI ("nút vô hiệu hoá") — KHÔNG có "hệ thống xử lý đúng".
- **Trace nguồn:** mỗi AC ghi rõ FR/BR/E ở tiêu đề → dev/QA biết AC bắt nguồn từ đâu.
- **Không bịa:** ngưỡng 30.000đ và mọi wording lấy từ spec; nếu spec thiếu số liệu → `/ac` đánh OQ thay vì tự chế.

> Nếu thanh toán online cũng nằm trong story này, thêm AC negative cho **E-food-delivery-004** (timeout). Số giây timeout chưa có trong spec (OQ-1) → AC ghi điều kiện chung + đánh OQ, KHÔNG bịa "sau 30s".
