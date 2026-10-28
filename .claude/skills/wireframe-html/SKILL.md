---
name: wireframe-html
description: Dùng khi cần tạo wireframe HTML (đen trắng, đơn giản) cho các flow của 1 feature, render element HTML thật thay vì ASCII. Kích hoạt bằng `/wireframe-html <feature>`. Cần có `srs/{feature}-userflow.md` trước (skill tự chạy `/user-flow` nếu chưa có). Nếu `/wireframe-ascii` đã chạy trước cho screen đó, đọc lại bảng mô tả ASCII làm nguồn element thay vì suy luận lại từ đầu.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Task, AskUserQuestion
user-invocable: true
disable-model-invocation: true
argument-hint: "<feature> [--flow <flow-slug>]"
---

# /wireframe-html — HTML Wireframe Generator

> Skill chạy `context: fork` (read nhiều file + compose HTML). Main context giữ sạch.

## Goal

Sinh **HTML wireframe file** (B&W, không màu sắc) cho từng luồng của 1 feature. Mỗi flow = 1 HTML file tự-contained. Mỗi screen render trong **khung có bề rộng device thật** (mobile 375 / tablet 768 / desktop 1024px — lấy từ `srs/{feature}-userflow.md` frontmatter `primary_device`), các screen **tự wrap** xuống dòng theo bề rộng device (KHÔNG ép 3/row). Mỗi screen render **HTML element thật** — `<input>`, `<button>`, `<a>`, `<label>`... không dùng `<pre>` ASCII.

> **Vì sao khung device thật:** card "33% chiều ngang" cũ làm mobile login và desktop dashboard cùng size → trông giả, sai tỉ lệ. Render đúng bề rộng device cho tỉ lệ thật.

ASCII (`/wireframe-ascii`) và HTML là 2 renderer **ngang hàng** của cùng 1 screen. Skill nào chạy **trước** vẫn tự suy luận element từ tài liệu nghiệp vụ; skill chạy **sau** đọc lại kết quả của skill trước làm nguồn, tránh suy luận 2 lần lệch nhau — xem Phase B.5. Cả hai dùng chung 1 nguồn chia flow: `docs/{feature}/srs/{feature}-userflow.md`.

Ngay dưới phần wireframe của mỗi flow, skill sinh thêm **bảng mô tả màn hình** (5 cột: `#` / Items / Control type / Data type / Description) — 1 bảng duy nhất, gộp tất cả screens của flow, phân đoạn theo `Screen N: {tên screen}`. Xem Phase F.5.

**Thang fidelity 3 bậc:** `/wireframe-ascii` (lo-fi chat-native) → `/wireframe-html` (lo-fi B&W, layout-accurate — bậc NÀY) → `/prototype-html` (hi-fi, tokens + JS). ASCII và HTML **cùng bậc lo-fi, 2 renderer** cùng 1 screen.

**Điểm khác biệt với `/prototype-html`:**
- `/wireframe-html` → B&W static layout, không JS navigation, mục đích review scope/layout + tỉ lệ device nhanh.
- `/prototype-html` → màu sắc đầy đủ (design tokens), JS click-through, mục đích stakeholder demo.

## Constraints

- **Cần `srs/{feature}-userflow.md` trước.** Chưa tồn tại/chưa duyệt → skill tự gọi `/user-flow <feature>` (Phase A), KHÔNG tự chia flow riêng.
- **Confirm device size với user TRƯỚC khi vẽ (Phase A bước 4)** — Mobile 375 / Tablet 768 / Desktop 1024 / Responsive. Đề xuất sẵn từ `primary_device`/design.md nhưng KHÔNG tự chốt im lặng (device là quyết định thiết kế).
- **L1 plan preview** trước khi write bất kỳ file.
- **L2 diff** cho `{feature}-wireframe-html-index.md` khi file đã tồn tại (update mode tự động).
- **`<feature>` bắt buộc** (positional arg, auto-infer khi chỉ 1 feature match từ arg).
- **Nguồn element ưu tiên: ASCII đã có → tài liệu nghiệp vụ.** Screen đã có `ascii-wireframe/{flow-slug}.md` → đọc bảng mô tả **5 cột** của screen đó (cùng schema) làm nguồn field/action/validation (Phase B.5), KHÔNG suy luận lại từ đầu, KHÔNG re-infer màn ASCII đã tả. Screen chưa có ASCII → tự suy luận từ brainstorm/URD/PRD/SRS spec như cũ. `userflow.md` cho biết flow nào gồm màn nào + mục đích từng màn.
- **Bảng mô tả 5 cột (Phase F.5)**: khi tài liệu nghiệp vụ thiếu chi tiết validation cụ thể cho 1 field (vd giới hạn ký tự nhưng không nói rõ charset cho phép, hoặc upload không nói rõ dung lượng/định dạng) → skill PHẢI hỏi user bổ sung (từng field một, theo no-re-ask rule), KHÔNG tự suy đoán hoặc bịa quy tắc không có nguồn.
- **B&W strict**: CSS chỉ dùng `#000`, `#fff`, `#f0f0f0`, `#888`, `#ccc` — KHÔNG dùng màu có sắc.
- **Self-contained HTML**: không có external CSS/JS dependencies. Inline tất.
- **Cross-flow screens**: flow B bắt đầu từ màn hình thuộc flow A → bao gồm màn hình đó, nhãn `[chung]`.
- **Vietnamese-first** labels. User nói "viết bằng tiếng Anh" để switch.
- **BA conventions** — L1 prose preview, no-re-ask rule, IT-BA framing. Per @../../rules/ba-conventions.md.

## Inputs

```
/wireframe-html <feature>                    # tất cả flows
/wireframe-html <feature> --flow <slug>      # 1 flow cụ thể
```

Muốn đổi hành vi mặc định, nói bằng lời:
- File flow đã tồn tại → skill tự regenerate (L2 diff mỗi file), không cần flag; muốn sửa gọi lại skill và nói cần đổi gì.
- Viết bằng tiếng Anh → nói "viết bằng tiếng Anh".

## Context (dynamic)

Today: !`date +%Y-%m-%d`
Features có sẵn: !`ls -d docs/*/ 2>/dev/null | xargs -I{} basename {} | grep -v "^_" | head -20`
Features có userflow.md (nguồn chia flow BẮT BUỘC): !`for d in docs/*/srs/*-userflow.md; do [ -f "$d" ] && dirname "$d" | xargs dirname | xargs basename; done 2>/dev/null | head -20`
Features đã có html-wireframe: !`for d in docs/*/html-wireframe/*-wireframe-html-index.md; do [ -f "$d" ] && dirname "$d" | xargs dirname | xargs basename; done 2>/dev/null | head -20`

## Output

```
docs/{feature}/html-wireframe/
  {feature}-wireframe.html                           ← INDEX ĐIỀU HƯỚNG (cửa vào — double-click mở browser: sidebar TOC + flow map + iframe). Xem Phase G.5.
  {feature}-wireframe-html-index.md                  ← master index metadata (type: wireframe-html-index, cho git/Obsidian)
  {flow-slug}.html           ← 1 file per flow (mỗi screen có id="s{n}" để index deep-link)
  {flow-slug-2}.html
  ...
```

Sau generate: cập nhật `docs/{feature}/ascii-wireframe/{feature}-wireframe-index.md` cột `HTML wireframe` (nếu tồn tại — 2 renderer ngang hàng, cross-link để dễ tra cứu, xem Phase H).

## Approach

### Phase A — Parse & Validate

1. Extract `<feature>` từ args. Validate `docs/{feature}/` tồn tại → OK.
2. Check `docs/{feature}/srs/{feature}-userflow.md`:
   - Tồn tại + `stage: flow-approved` → Read, dùng làm nguồn chia flow + danh sách màn hình.
   - Chưa tồn tại hoặc chưa duyệt → **tự động gọi `/user-flow <feature>`** trước khi tiếp tục. Skill này KHÔNG tự chia flow riêng.
3. Nếu `--flow <slug>`: chỉ xử lý flow đó (phải khớp 1 flow-slug trong userflow.md Mục 3).
4. **Confirm device size với user (BẮT BUỘC — KHÔNG tự chốt im lặng).** Device quyết định bề rộng khung → là quyết định thiết kế, phải để user chốt trước khi vẽ:
   - Đề xuất sẵn 1 device từ nguồn (ưu tiên `userflow.md` `primary_device`; thiếu thì suy từ `docs/design.md` Breakpoints/Max-width) để user chỉ cần xác nhận.
   - Hỏi qua AskUserQuestion: **Mobile 375 / Tablet 768 / Desktop 1024 / Responsive (nhiều breakpoint)** — option đề xuất để đầu + note "(đề xuất — từ {nguồn})".
   - User chọn khác → dùng lựa chọn của user. Nếu userflow chưa có `primary_device` → sau khi user chốt, gợi ý ghi ngược vào userflow frontmatter (để lần sau + `/prototype-html` dùng chung).
   - KHÔNG suy 1 device rồi vẽ luôn không hỏi — kể cả khi design.md rõ ràng.

### Phase B — Read Upstream Docs

- **KG chọn nguồn trước (rẻ hơn scan):** chạy `node .claude/skills/kg/engine/kg-query.mjs facts {feature}` và `node .claude/skills/kg/engine/kg-query.mjs neighbors <doc-path>` khi có doc mốc để lấy danh sách candidate/coverage cho FR/UC/E nguồn của screen, rồi VẪN Read đầy đủ prose file đã chọn. Tuân `.claude/rules/kg-usage.md` (3 nghĩa vụ: `--all` khi bị cap · đọc mục "Phải Read tay" · `KG-ERROR` → scan trực tiếp như cũ).

Đọc song song các file sau (optional — warn nếu thiếu, không abort):

| File | Mục đích |
|------|----------|
| `docs/{feature}/srs/{feature}-userflow.md` | Mục 2 (danh sách màn hình + mục đích) + Mục 3 (chia flow, screens/flow theo thứ tự) — **nguồn chính cho flow + screen order** |
| `docs/{feature}/brainstorms/*.md` | Core flows, field/action cụ thể cho từng màn |
| `docs/{feature}/{feature}-urd.md`, `prd.md` | User needs, capabilities liên quan tới màn hình |
| `docs/{feature}/srs/{feature}-spec.md` | FR/NFR/Business Rules — validation cụ thể cho field |
| `docs/{feature}/usecases/{feature}-usecase-index.md` (nếu có) | Bảng UCs — bổ sung ngữ cảnh nghiệp vụ, KHÔNG dùng để chia flow (đã có userflow.md) |
| `docs/{feature}/ascii-wireframe/{flow-slug}.md` (nếu tồn tại) | Nguồn element ưu tiên cho screen đã có ASCII — xem Phase B.5 |

### Phase C — Identify Flows

Flow = đọc thẳng `srs/{feature}-userflow.md` Mục 3 (danh sách flow: flow-slug + tên + screens gồm + cases phủ). KHÔNG tự tổng hợp từ nhiều nguồn nữa — `userflow.md` đã là nguồn chia flow chung với `/wireframe-ascii`.

Preview để user confirm (xem Phase E).

### Phase B.5 — Check ASCII wireframe đã có (đọc-lại nếu tồn tại)

Với mỗi screen: check `docs/{feature}/ascii-wireframe/{flow-slug}.md` đã tồn tại chưa (`/wireframe-ascii` đã chạy trước cho flow này).

- **Có** → đọc block `## Screen: {slug}` — bảng "Screen description" **5 cột** (cùng schema `# / Items / Control type / Data type / Description`) — dùng thẳng làm nguồn element cho screen đó, KHÔNG re-infer. Chỉ đọc thêm nghiệp vụ nếu ASCII thiếu chi tiết validation.
- **Chưa có** → Phase D/F tự suy luận như bình thường từ tài liệu nghiệp vụ.

### Phase D — Map Screens to Flows (Per Flow)

Với mỗi flow, lấy **ordered list of screen slugs** trực tiếp từ `userflow.md` Mục 3 (cột "Màn hình gồm", theo đúng thứ tự liệt kê).

**Cross-flow screen detection:** screen đầu flow B thuộc flow A → include + nhãn `[chung với {other-flow}]` (đối chiếu Mục 2 cột "Thuộc flow" nếu 1 screen xuất hiện ở nhiều flow).

**Element source cho mỗi screen:** ưu tiên kết quả Phase B.5 (ASCII đã có) nếu tồn tại; nếu không, tự suy luận field/action từ brainstorm + URD/PRD + SRS spec (Business Rules, Error Matrix) liên quan tới mục đích màn (lấy từ `userflow.md` Mục 2 cột "Mục đích"). Thiếu chi tiết rõ ràng (cả 2 trường hợp) → hỏi user (xem Phase F.5 Gap check — áp dụng ngay từ bước thu thập element, không chỉ validation).

### Phase E — L1 Plan Preview

```
Em sẽ tạo {N} file HTML wireframe trong `docs/{feature}/html-wireframe/`:

  1. {flow-name} → {flow-slug}.html
     Screens: {slug-1} → {slug-2} → {slug-3} → {slug-4}
     Device: {mobile 375 / tablet 768 / desktop 1024} · {N} màn hình (tự wrap)
  ...

  Cộng thêm: {feature}-wireframe.html (index điều hướng — mở cái này) + {feature}-wireframe-html-index.md (metadata).

Apply? (Y / sửa / skip <số>):
```

### Phase F — Generate HTML (Per Flow)

Với mỗi flow được duyệt:

1. **Xác định element mỗi screen**: ưu tiên nguồn Phase B.5 (bảng mô tả ASCII đã có) nếu tồn tại; nếu không, từ mục đích màn (`userflow.md` Mục 2) + brainstorm/URD/PRD/SRS spec liên quan — tự suy luận field/action/state cần có cho screen đó.
2. **Lập element table nội bộ** (tương đương Mục 2 cũ): mỗi field/action 1 row theo thứ tự xuất hiện dự kiến trên màn.
3. **Infer screen title** từ mục đích màn trong `userflow.md` Mục 2.
4. **Map elements → HTML** (xem Mục "Element Mapping"). Icon = token chữ `(eye)`/`(play)` hoặc SVG stroke B&W — KHÔNG emoji.
5. **Device**: dùng device **user đã chốt ở Phase A bước 4** (đã confirm, không tự đoán lại). Điền `{{DEVICE}}`.
6. **Sinh `{{SCREENS}}`**: mỗi screen 1 khối `<div class="wf-screen" id="s{n}">` (n = thứ tự screen từ 1 — BẮT BUỘC có `id` để index Phase G.5 deep-link tới), frame rộng đúng device, đặt liền nhau trong `.wf-rows` — **tự wrap**, KHÔNG ép 3/row, KHÔNG mũi tên giữa screen.
7. **Render HTML** từ `_templates/wireframe-html-template.html` (xem Mục "HTML Template" — thay placeholder + fill `{{SCREENS}}`).
8. **Fill `{{DESC_TABLE}}`** — xem Phase F.5 ngay dưới, chạy TRƯỚC khi Write.
9. **Write** `docs/{feature}/html-wireframe/{flow-slug}.html`.

### Phase F.5 — Bảng mô tả màn hình (5 cột)

Ngay sau khi parse xong Mục 2 của mọi screen trong flow (bước F.2), build **1 bảng duy nhất** cho toàn flow, đặt dưới `{{SCREENS}}` trong HTML (khối `{{DESC_TABLE}}`).

**Cấu trúc bảng** (đúng theo mẫu tham khảo của user — 5 cột):

| # | Items | Control type | Data type | Description |
|---|-------|--------------|-----------|--------------|
| 1 | {Tên field/element} | {Loại control} | {Loại data} | {Mô tả nghiệp vụ + validation đầy đủ} |

Table chia theo screen — mỗi screen mở đầu bằng 1 hàng full-width `Screen {N}: {screen title}`, rồi các field của screen đó đánh số lại từ 1.

**1. Xác định `Control type`** (map từ Mục 2 "Element" + Mục 1 ASCII layout):

| Element hint | Control type |
|---|---|
| Text hiển thị tĩnh, không sửa được | `Label` |
| Input text/email/password 1 dòng | `Textbox` |
| Textarea nhiều dòng | `Text area` |
| Button (Primary/Secondary/Google...) | `Button` |
| Link / navigate text | `Link` |
| Checkbox | `Checkbox` |
| Radio button | `Radio button` |
| Dropdown / select | `Dropdown` |
| Upload / drag-drop file | `Browse Button` |
| Banner / thông báo tĩnh | `Label` |

**2. Xác định `Data type`** (map từ hành vi tương tác — KHÔNG phải kiểu dữ liệu lập trình):

| Hành vi | Data type |
|---|---|
| Không sửa/không click được (label, banner tĩnh) | `ReadOnly` |
| Nhập text tự do | `Text` |
| Click để trigger action (button, link) | `Click` |
| Chọn 1 trong nhiều (radio, checkbox) | `Check` |
| Chọn từ danh sách (dropdown) | `Select` |
| Upload file | `Click` (browse) + note định dạng/size trong Description |

**3. Viết `Description` SÂU (6 lớp)** — per `ba-conventions.md` Mục 6, KHÔNG nông:
1. **Mục đích nghiệp vụ** — business meaning 1 câu.
2. **Validation / ràng buộc** — bắt buộc/tùy chọn, rule cụ thể (trích BR-xxx), default, placeholder; nêu cả điều KHÔNG áp.
3. **States** — default/focus/disabled/submitting/error/success (chỉ state element thật sự có).
4. **Navigation** — trigger đi màn nào, điều kiện enable/disable.
5. **Error + wording** — mã `E-{feature}-NNN` + wording exact + hệ quả (tăng/không tăng counter...).
6. **Edge/security/compliance** — anti-enumeration, audit log, lỗi mạng, auto-link, fallback... (trích NFR-xxx) khi áp dụng.

Gọn nhưng đủ; KHÔNG lặp 1 mã ID nhiều lần. Nguồn: **`srs/{feature}-spec.md` (FR/BR/NFR/Error Matrix) + `uc-*.md` branches** > brainstorm/PRD/URD, đối chiếu `userflow.md` cho case error/edge. Thiếu nguồn → Gap check (bước 4 dưới) hỏi user.

**4. Gap check (BẮT BUỘC trước khi viết Description cho field đó):**

Với mỗi field có validation nhắc tới giới hạn (ký tự, dung lượng, định dạng) nhưng **tài liệu nghiệp vụ không nói rõ chi tiết** (vd "Tối đa 50 ký tự" nhưng không nói ký tự nào được phép), skill KHÔNG tự suy đoán hay bịa thêm rule. Skill gom các field thiếu chi tiết này lại, hỏi user từng field một (theo no-re-ask rule — không hỏi lại field đã có đủ info):

```
Field "{tên field}" (screen {slug}) có giới hạn "{rule hiện có}" nhưng chưa rõ:
  - Cho phép nhập ký tự gì (chữ/số/unicode/ký tự đặc biệt)?
  - {câu hỏi cụ thể khác nếu áp dụng, vd định dạng file/kích thước khuyến nghị}
```

Chỉ sau khi user trả lời (hoặc explicit nói "bỏ qua, giữ nguyên mô tả hiện có") mới viết Description hoàn chỉnh + tiếp tục Phase F bước 7.

**5. Format HTML của bảng** — dùng `<table class="wf-desc-table">` (xem template), 1 bảng cho cả flow, `<tr class="wf-desc-screen-header">` cho hàng phân đoạn `Screen N: {title}`.

### Phase G — Write {feature}-wireframe-html-index.md

Tạo `docs/{feature}/html-wireframe/{feature}-wireframe-html-index.md`:

```yaml
---
type: wireframe-html-index
feature: {feature}
status: draft
updated: {date}
links:
  - docs/{feature}/srs/{feature}-userflow.md
---

(Env note cho activity.log: `initial {N} flow wireframes generated`)

# {feature} — HTML Wireframes

> HTML wireframe files (B&W, static) cho các flows. Mỗi file = 1 luồng người dùng, double-click mở browser. Nguồn: `srs/{feature}-userflow.md` (chia flow) + tài liệu nghiệp vụ (elements) — độc lập với `ascii-wireframe/`.

## Flows

| # | Flow | File | Screens (theo thứ tự) | Status | Updated |
|---|------|------|-----------------------|--------|---------|
| 1 | {flow-name} | [{flow-slug}.html]({flow-slug}.html) | {slug-1} → {slug-2} → ... | draft | {date} |

**Status:** `draft` / `reviewed` / `approved`.

## Links upstream

- [[docs/{feature}/srs/{feature}-userflow.md|User Flow]]
- [[docs/{feature}/brainstorms/|Brainstorms]]
- [[docs/{feature}/srs/{feature}-spec.md|SRS Spec]]

## Changelog

> Newest on top. Routing: edits đến `{flow-slug}.html` → append entry ở đây với prefix `[{flow-slug}]`.
```

### Phase G.5 — Sinh index điều hướng HTML `{feature}-wireframe.html`

> Feature nhiều flow (epic phức tạp) → mở từng file `.html` rời rất khó điều hướng. File index HTML này là **cửa vào duy nhất**: double-click mở browser, có sidebar TOC (flow → screen) + tab "Tổng quan" là flow map click được + iframe load từng flow. Mỗi flow VẪN là 1 file riêng (KHÔNG gộp) — index chỉ là lớp điều hướng.

1. **Điều kiện anchor**: khi render mỗi flow file (Phase F), mỗi block `.wf-screen` PHẢI có `id="s{n}"` (n = thứ tự screen trong flow, từ 1). Đây là đích cho deep-link `{flow-slug}.html#s{n}` từ index. (Nếu quên → link vẫn mở đúng file, chỉ không auto-scroll tới screen.)
2. **Read** `_templates/wireframe-html-nav-template.html`.
3. **Thay placeholder**: `{{LANG}}` `{{FEATURE}}` `{{DEVICE}}` (primary_device) `{{FLOW_COUNT}}` `{{SCREEN_COUNT}}`.
4. **Sinh `{{TOC}}`**: mỗi flow (thứ tự theo `userflow.md` Mục 3) → 1 `.toc-section` + link flow + N link screen (`data-src="{flow-slug}.html"`, `data-scroll="{n}"`). Mẫu ở cuối template.
5. **Sinh `{{FLOWMAP}}`**: mỗi flow → 1 `.flowgroup` (chain node click được). Node class theo `userflow.md` Mục 3 cột "Cases phủ": màn rỗng/loading → `.node edge`, màn lỗi → `.node error`, còn lại happy (mặc định). Mẫu ở cuối template.
6. **Write** `docs/{feature}/html-wireframe/{feature}-wireframe.html`. L2 diff nếu đã tồn tại.

> File index này thay thế vai trò "cửa vào" của `{feature}-wireframe-html-index.md` (bảng markdown chỉ xem được trong IDE). Vẫn giữ file `.md` (metadata + git + Obsidian), nhưng khi cần **xem/điều hướng thực tế** thì mở `{feature}-wireframe.html`.

### Phase H — Cross-link ascii-wireframe/{feature}-wireframe-index.md (nếu tồn tại)

Nếu `docs/{feature}/ascii-wireframe/{feature}-wireframe-index.md` tồn tại (feature cũng có ASCII wireframe qua `/wireframe-ascii`), thêm/cập nhật cột `HTML wireframe` trong bảng Screens (L2 diff trước khi edit) — chỉ để tra cứu chéo, KHÔNG phải quan hệ phụ thuộc. Không tồn tại → bỏ qua bước này, không tạo mới.

### Phase I — Activity log

Trước Write set env `CLAUDE_SKILL_NAME=/wireframe-html` + `CLAUDE_CHANGELOG_AUTHOR={@author}` + `CLAUDE_CHANGELOG_NOTE=[all] generated {N} flows: {slug-1}, {slug-2}, ...` (≤80 ký tự). Hook ghép cả dòng vào `docs/_shared/activity.log`:

```
{date} | /wireframe-html | {@author} | {file-path} | [all] generated {N} flows: ...
```

---

## Element Mapping (Mục 2 → HTML)

Skill đọc bảng Mục 2 "Screen description" và map mỗi row thành HTML element tương ứng.

### Mapping table

| Mục 2 "Items" label | Data type | HTML output |
|---|---|---|
| `(Textbox)` text thường | Text | `<div class="field"><label>…</label><input type="text" placeholder="…"></div>` |
| `(Textbox)` có "masked" / "password" | Text | `<div class="field"><label>…</label><div class="input-pw"><input type="password"><span class="eye">(eye)</span></div></div>` (token chữ, KHÔNG emoji) |
| `(Checkbox)` | Boolean | `<label class="checkbox"><input type="checkbox"> label text</label>` |
| `(Button Primary)` | Click | `<button class="btn-primary">label</button>` |
| `(Button Secondary)` | Click | `<button class="btn-secondary">label</button>` |
| `(Link)` hoặc Navigate | Navigate | `<a class="wf-link">label</a>` |
| `(Label)` / `(Banner)` ReadOnly | ReadOnly | `<p class="info-label">text</p>` |
| `(Banner)` có ℹ / info | ReadOnly | `<div class="banner banner-info"><span>ℹ</span> text</div>` |
| `(Banner)` có ⚠ / warning | ReadOnly | `<div class="banner banner-warn"><span>⚠</span> text</div>` |
| Password policy checklist | ReadOnly | `<div class="pw-check"><span class="ok">✓ criterion</span> <span class="fail">✗ criterion</span></div>` |
| Countdown / timer | ReadOnly | `<p class="hint-text">Có thể gửi lại sau 0:54</p>` |
| Divider / separator | — | `<div class="divider"><span>hoặc</span></div>` (infer từ ASCII "─── hoặc ───") |
| Google button | Click | `<button class="btn-google"><span class="g-icon">G</span> label</button>` |
| `(Modal trigger)` | ReadOnly | Modal overlay box `<div class="modal-box">` |

### Infer từ Mục 2 description column

Skill đọc Description column để lấy:
- **Placeholder text**: `Placeholder "..."` → `input placeholder="..."`
- **Disabled state text**: `Disabled khi ...` → thêm `class="state-hint"` + text nhỏ bên dưới element (italic)
- **Display rule**: `Display rule: ...` → thêm text nhỏ italic bên dưới
- **Error text** (E-xxx): KHÔNG render error inline — chỉ thêm tooltip-style `title="..."` attribute
- **Success** / navigate text: bỏ qua (chỉ render static state)

### Modal box

Khi row có `(Modal trigger)` → render modal như 1 box nổi lên bên trong screen frame:

```html
<div class="modal-box">
  <div class="modal-title">Modal title</div>
  <!-- modal elements tiếp tục từ rows sau trong cùng Mục 2 -->
</div>
```

Các row có "(trong modal)" → nằm bên trong `<div class="modal-box">` đó.

---

## HTML Template

> **Template chuẩn sống ở file riêng:** `_templates/wireframe-html-template.html`.
> Skill KHÔNG carry CSS/skeleton inline — luôn đọc template đó làm nguồn render duy nhất.

Trong Phase F, mỗi flow:

1. **Read** `_templates/wireframe-html-template.html` (full CSS B&W + skeleton + mẫu `{{SCREENS}}`).
2. **Thay placeholder** ở khung ngoài rồi điền `{{SCREENS}}` bằng các khối screen:

   | Placeholder | Giá trị |
   |---|---|
   | `{{LANG}}` | `vi` (default) / `en` nếu user nói "viết bằng tiếng Anh" |
   | `{{FEATURE}}` | feature slug |
   | `{{FLOW_TITLE}}` | tên flow hiển thị |
   | `{{FLOW_SLUG}}` | kebab-case slug |
   | `{{SCREEN_COUNT}}` | số màn hình trong flow |
   | `{{DATE}}` | ISO date |
   | `{{DEVICE}}` | `mobile` / `tablet` / `desktop` — từ `srs/{feature}-userflow.md` frontmatter `primary_device` (thiếu → `mobile`). Quyết định bề rộng frame (375/768/1024). |
   | `{{FLOW_DESC}}` | 1 câu mô tả flow (brainstorm / UC) |
   | `{{SCREENS}}` | các `.wf-screen` (mỗi screen 1 frame bề rộng device, tự wrap) — mẫu nằm cuối template |
   | `{{DESC_TABLE}}` | các `<tr>` bảng mô tả 5 cột, chia theo Screen N — xem Phase F.5 + mẫu cuối template |

3. **Render element bên trong mỗi screen** từ Mục 2 Screen description (xem "Element Mapping" trên).
4. **Bất biến**: B&W strict (chỉ `#000 #fff #f0f0f0 #888 #ccc`), self-contained (inline hết), frame rộng đúng device (`data-device`), screens tự wrap (KHÔNG ép 3/row, KHÔNG mũi tên giữa screen), icon = token chữ/SVG (KHÔNG emoji). KHÔNG tự bịa class/màu ngoài template.
5. **Write** `docs/{feature}/html-wireframe/{flow-slug}.html`.

> Cần đổi diện mạo wireframe (spacing, font, class mới) → sửa **template file**, KHÔNG sửa trong skill — mọi flow tự kế thừa.

---

## Naming

| Flow source | HTML filename |
|---|---|
| `userflow.md` Mục 3 flow-slug | dùng thẳng flow-slug làm filename |
| Manual (`--flow` không khớp flow-slug nào có sẵn) | kebab-case slug user nhập |

Collision: trùng slug → suffix `-2`.

## Gotchas

- **Đừng tự chia flow.** Nguồn chia flow DUY NHẤT là `srs/{feature}-userflow.md` — nếu chưa có/chưa duyệt, gọi `/user-flow` trước.
- **Đọc lại ASCII wireframe nếu đã có** (Phase B.5) — tránh 2 skill tự suy luận field/validation độc lập rồi lệch nhau. Cùng schema 5 cột nên dùng thẳng, KHÔNG cần map; màn ASCII đã tả thì KHÔNG re-infer (single-source).
- **Screen thiếu thông tin từ nghiệp vụ** → render placeholder `<p class="hint-text">[Chưa có đủ thông tin nghiệp vụ]</p>`, đồng thời hỏi user theo Phase F.5 Gap check.
- **Modal elements** (suy luận từ nghiệp vụ có bước xác nhận/dialog) → gom vào `<div class="modal-box">`.
- **Form KHÔNG trải rộng hết khung desktop.** Screen dạng form/auth/dialog (login, signup, forgot-password, modal) → bọc field+nút trong `<div class="wf-form">` (box căn giữa, max-width ~380px) để input/nút full-width TRONG box đó, KHÔNG kéo dài full 1024px của khung desktop (trông sai, không giống màn thật). Full-content screen (dashboard/list/table) thì render thẳng, không cần `.wf-form`. Trên mobile 375 thì `.wf-form` tự = gần full width. Thêm class `.wf-form.card` nếu muốn viền box rõ.
- **State loại trừ nhau → TÁCH SCREEN RIÊNG, KHÔNG side-by-side.** Nếu 1 màn có ≥2 kết quả loại trừ (chỉ 1 hiện tùy điều kiện — vd verify-email-result: thành công / hết-hạn, payment-result: success / fail) → render **mỗi state 1 `.wf-screen` riêng** (vd `verify-email-success`, `verify-email-expired`), KHÔNG nhồi 2 div cạnh nhau trong 1 khung (gây hiểu nhầm "màn có cả 2"). Ghi rõ trong screen-slug. Chỉ dùng chung 1 khung khi các phần **cùng hiện đồng thời** (không loại trừ). Nếu `userflow.md` gộp chung 1 screen → note đề xuất tách + hỏi user, hoặc tách ngầm với slug `{screen}-{state}`.
- **Google button**: detect khi nghiệp vụ mention "Google" hoặc "OAuth" → render `.btn-google`.
- **Divider "hoặc"**: khi nghiệp vụ có 2 phương thức song song (vd đăng nhập email hoặc Google) → render `<div class="divider"><span>hoặc</span></div>`.
- **Back navigation**: khi màn có đường quay lại rõ trong `userflow.md` (nhánh `-.->`) → render `<div class="back-nav">← text</div>`.
- **Font**: `-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` cho body text. KHÔNG dùng emoji/icon libs.

## Workflow tiếp theo

- **`/figma <feature> [<screen-slug>]`** — vẽ Figma từ ASCII (`/wireframe-ascii` bắt buộc chạy trước cho `/figma`; nếu chưa có, `/figma` refuse).
- **`/prototype-html <feature>`** — HTML clickable prototype có màu sắc + JS navigation (hi-fi).

## References

- @../../../_templates/wireframe-html-template.html (template chuẩn per-flow — CSS B&W + skeleton + mẫu screens)
- @../../../_templates/wireframe-html-nav-template.html (template index điều hướng — sidebar TOC + flow map + iframe, Phase G.5)
- @../../rules/approval-gate.md
- @../../rules/kg-usage.md
- @../../rules/naming-conventions.md
- @../../rules/changelog.md
- @../../rules/feature-bootstrap.md
- @../../rules/ba-conventions.md
- @../user-flow/SKILL.md (nguồn chia flow — chạy trước nếu chưa có)
- @../wireframe-ascii/SKILL.md (renderer ngang hàng — đọc lại nếu đã chạy trước, xem Phase B.5)
- @../prototype-html/SKILL.md (high-fidelity HTML clickable)
