<!--
Template 1 trang cẩm nang vận hành (userguide section). ZERO frontmatter — metadata sống ở
docs/userguide/userguide-index.md. Mỗi trang TỰ ĐỨNG VỮNG (Every Page Is Page One): có context tối thiểu,
liên kết sang trang liên quan, KHÔNG giả định đã đọc trang trước.

Tiêu đề H1 bắt đầu bằng ĐỘNG TỪ cho trang How-to (vd "Khóa tài khoản người dùng"), bằng danh từ
cho Reference/Explanation (vd "Tổng quan hệ thống", "Bảng tra cứu cài đặt").

Chọn 1 trong các khung dưới theo loại Diátaxis của trang (A How-to · B Reference · C Troubleshooting ·
D Explanation · E FAQ · F Glossary). Bỏ các mục không dùng.

Placeholder `{{feature}}` (vd srs/{{feature}}-spec.md) là ký hiệu — skill /userguide PHẢI thay bằng slug
feature thật trước khi Write, KHÔNG để lọt vào trang stakeholder đọc.
-->

# {Tiêu đề trang}

> {1 câu: trang này giúp người vận hành làm/hiểu gì. Đứng độc lập, không cần đọc trang trước.}

<!-- ───────────────── KHUNG A — HOW-TO (hướng dẫn theo tác vụ) ───────────────── -->

**Khi nào dùng:** {tình huống người vận hành cần làm việc này.}

**Trước khi bắt đầu:** {điều kiện trước — quyền cần có, dữ liệu cần sẵn, trạng thái hệ thống. Đặt điều kiện TRƯỚC hành động.}

## Các bước

1. {Hành động — 1 việc/bước, bắt đầu bằng động từ.}
   → *Kết quả:* {hệ thống phản hồi gì sau bước này.}
2. {...}
3. {...}

![{caption mô tả ảnh + hành động}](images/{slug}.png)

<!-- CHỖ CHỤP ẢNH — {slug}.png · Màn: {tên màn/URL} · Bước: {bước nào trong Các bước}
     Chụp: {trạng thái cần chụp — vd "sau khi bấm Translate, ô Enter Text đang mở"}
     Đánh dấu: (1) {vùng} · (2) {vùng} · (3) {vùng}   (khớp bảng callout dưới) -->

| # callout | Vùng trên màn hình | Thao tác |
|-----------|--------------------|----------|
| (1) | {nút/trường} | {làm gì} |
| (2) | {...} | {...} |

<!-- Tối đa 1–3 callout/ảnh. >10 thao tác → tách ảnh. Nếu có wireframe ASCII sẵn, nhúng thay placeholder.
     Nếu user TỰ chụp (không cấp quyền auto): giữ placeholder + comment "CHỖ CHỤP ẢNH" ở trên làm brief
     — user chỉ việc bỏ file đúng tên {slug}.png vào images/, callout (1)(2)(3) trong bảng đã sẵn để họ vẽ theo. -->

**Xử lý khi lỗi:** {lỗi hay gặp ở tác vụ này → trỏ sang trang Xử lý sự cố mã E-... nếu có.}

**Liên quan:** [Trang X](./{khac}.md) · [Tra cứu Y](../tra-cuu.md)

<!-- ───────────────── KHUNG B — REFERENCE (tra cứu) ───────────────── -->

Tra cứu nhanh {settings / menu / giới hạn / phím tắt}. Bảng đầy đủ, khô khan, không kể chuyện.

| Mục | Ý nghĩa | Giá trị / Giới hạn | Ghi chú |
|-----|---------|--------------------|---------|
| {tên} | {nghĩa nghiệp vụ} | {giá trị cụ thể từ SRS — KHÔNG bịa} | {} |

<!-- ───────────────── KHUNG C — TROUBLESHOOTING (xử lý sự cố) ───────────────── -->

Tra theo triệu chứng người dùng/người vận hành gặp. Nguồn: Error Matrix trong srs/{{feature}}-spec.md.

| Mã lỗi | Triệu chứng (người dùng thấy) | Nguyên nhân | Cách xử lý |
|--------|-------------------------------|-------------|------------|
| {E-feature-NNN} | {thông báo / hiện tượng} | {nguyên nhân nghiệp vụ} | {bước khắc phục cho người vận hành} |

<!-- ───────────────── KHUNG D — EXPLANATION (tổng quan / khái niệm) ───────────────── -->

{Giải thích bối cảnh + mô hình nghiệp vụ + lý do. Đây là nơi DUY NHẤT được kể chuyện —
không nhồi bước thao tác (đẩy sang How-to) hay bảng tra đầy đủ (đẩy sang Reference).}

**Thuật ngữ chính:** {term} — {định nghĩa ngắn, link Glossary}.

<!-- ───────────────── KHUNG E — FAQ (câu hỏi thường gặp) ───────────────── -->

Câu hỏi thực người vận hành hay hỏi. Mỗi câu 1 đáp ngắn, link sang trang chi tiết. KHÔNG lặp lại nguyên trang How-to/Reference — chỉ trả lời + trỏ.

**{Câu hỏi 1 dạng người dùng thật hỏi?}**
{Đáp ngắn 1-2 câu.} Xem [Trang X](./{khac}.md).

**{Câu hỏi 2?}**
{Đáp.}

<!-- ───────────────── KHUNG F — GLOSSARY (thuật ngữ) ───────────────── -->

Định nghĩa thuật ngữ riêng của sản phẩm. Nguồn: `docs/_shared/definitions.md`. Xếp theo bảng chữ cái.

| Thuật ngữ | Định nghĩa (nghĩa nghiệp vụ, 1-2 câu) |
|-----------|----------------------------------------|
| {Term} | {định nghĩa — trích definitions.md, KHÔNG bịa} |

<!-- ───────────────── Cuối mọi trang ───────────────── -->

<!-- Open Question nếu nguồn thiếu — KHÔNG bịa nội dung:
<!-- TBD: {chỗ thiếu} — nguồn BA chưa có. OQ-{n} -->
