# KG Usage — rule chung cho skill dùng Knowledge Graph

> Rule chung cho MỌI skill cần **chọn file / dựng ma trận ID / đếm trạng thái / detect upstream** trên vault. Engine: `.claude/skills/kg/engine/` (xem `.claude/skills/kg/SKILL.md`). Skill nhóm A (đọc-rộng-để-chọn) MUST reference file này trong Constraints + References; skill nhóm B/C không cần (đọc-để-render là bản chất, không cắt).

## Quy tắc vàng (contract 3.4bis — RÀNG BUỘC TỐI CAO)

> **Graph để CHỌN file + đếm cấu trúc; mọi kết luận nội dung/conflict/CR-diff LUÔN dựa trên prose đã Read, KHÔNG dựa facts.**

Token là phụ, context đúng là chính. Khi nghi ngờ → đọc thêm, đừng cắt.

## 3 nghĩa vụ BẮT BUỘC mỗi lần gọi kg-query

1. **`⚠ còn N mục — chạy với --all`** xuất hiện trong output → BẮT BUỘC chạy lại với `--all` lấy đủ danh sách trước khi Read. Không được làm việc trên danh sách cắt dở.
2. **Mục `### Phải Read tay (ngoài graph)`** → đọc TẤT CẢ file liệt kê (doc không parse được / parse thiếu = graph mù về chúng). Dòng `Độ phủ:` cho biết graph thiếu bao nhiêu.
3. **`KG-ERROR` (exit 2) hoặc lỗi bất kỳ** → graph không dùng được: quay về flow đọc-trực-tiếp cũ của skill (mỗi skill giữ mô tả flow cũ làm fallback). TUYỆT ĐỐI không suy diễn từ kết quả một phần.

## Lệnh theo mục đích

```bash
node .claude/skills/kg/engine/kg-build.mjs            # build (hook kg-refresh + lazy rebuild tự lo, hiếm khi cần tay)
node .claude/skills/kg/engine/kg-query.mjs impact <ID> --depth 3   # /cr: shortlist file bị ảnh hưởng
node .claude/skills/kg/engine/kg-query.mjs coverage <feature>      # /gap /userstory /ac /test-checklist: anti-join FR/UC/E/screen
node .claude/skills/kg/engine/kg-query.mjs facts <feature>         # định tuyến: FR/UC/US/screen/entity/OQ hiện có
node .claude/skills/kg/engine/kg-query.mjs trace <feature>         # /gap ma trận: dump TOÀN BỘ edge (from|type|to|provenance) + broken refs
node .claude/skills/kg/engine/kg-query.mjs neighbors <doc-path>    # 1-hop quanh 1 doc: upstream/downstream candidates
node .claude/skills/kg/engine/kg-query.mjs explore <ID|key>        # 1 node: định nghĩa + ai trỏ tới + trỏ tới ai
node .claude/skills/kg/engine/kg-query.mjs counts [--feature X]    # đếm nhanh cho banner/dashboard
node .claude/skills/kg/engine/kg-query.mjs crud <entity> --feature X  # entity bị UC nào C/R/U/D (cần CRUD matrix format mới)
node .claude/skills/kg/engine/kg-query.mjs suspect [--feature X]   # edge có upstream đổi sau downstream — tinh hơn stale thô
node .claude/skills/kg/engine/kg-query.mjs cypher > kg.cypher   # export Neo4j visualization (data export — KHÔNG footer, không --feature)
node .claude/skills/kg/engine/kg-viewer.mjs                     # sinh kg-viewer.html tự chứa — xem graph dạng hình trong browser
```

## Mẫu áp cho từng nhóm việc

| Việc skill đang làm | Thay bằng | GIỮ NGUYÊN (không được cắt) |
|---|---|---|
| Scan `docs/{feature}/**/*.md` dựng ma trận ID / tìm orphan | `kg coverage` + `kg orphans` | Read prose các node bị gap/conflict để kết luận |
| Read cả feature tìm file bị ảnh hưởng bởi 1 thay đổi | `kg impact <ID>` → shortlist | Read ĐẦY ĐỦ prose shortlist + grep value-sweep giá trị/keyword của change |
| Detect upstream candidates (glob nhiều folder + đọc thử) | `kg neighbors <doc>` / `kg facts <feature>` đề xuất danh sách | Read toàn văn upstream user đã chọn |
| Đếm doc theo status / feature cho banner, bảng | `kg counts` | — (thuần đếm, cắt an toàn) |
| Extract term/wording/convention từ prose | kg CHỈ chọn file đáng scan | Prose-scan toàn văn file đã chọn (facts không chứa wording) |
| Kiểm coverage FR→US→AC→test | `kg coverage` | Read story/AC/test prose khi viết hoặc sửa nội dung |

## Anti-patterns

- ❌ Dùng `kg facts` làm nguồn kết luận nội dung ("spec nói X") — facts không chứa điều kiện/ngoại lệ/wording.
- ❌ Bỏ qua mục "Phải Read tay" vì "graph đã đủ".
- ❌ Thấy shortlist ngắn bất thường mà không kiểm `Độ phủ:` — graph thiếu-phủ trông y hệt đầy-đủ.
- ❌ Cache output kg qua nhiều lượt edit (hook + lazy rebuild lo freshness, cứ gọi lại — build <1s).
- ❌ Skill nhóm B (render/đọc-nội-dung: export/userguide/preview/figma/prototype...) cắt phần đọc prose để "tiết kiệm" — đọc là sản phẩm.

## Tóm tắt 1 dòng

> **kg chọn — prose kết luận · --all khi bị cap · "Phải Read tay" là bắt buộc · KG-ERROR → flow cũ.**
