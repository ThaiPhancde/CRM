# 09 — Work order: Phase 10 product pages + pure-function table tests (Gemini, headless `agy -p`)

> Written 2026-11-02 by Claude (brain). Split **70/30** (D-54). Claude built the schema, services (fulfillment, COD settlement,
> products, PurchasingLink), the /van-don pages and all logic. Acceptance: Claude.

## 1. What you are producing

A demo CRM (Next.js 15 App Router, React 19, TypeScript, Tailwind 4, Vietnamese UI, white + orange). Each job delivers only its files.

Read before working (only these):
1. `AGENTS.md`; `docs/ui-design-system.md`.
2. THE CONTRACT (use exactly, do not edit):
   - `src/modules/products/service.ts` (`listProducts`, `productFilter`, `getProduct`, `unmatchedSkus`, `DEFAULT_LOW_STOCK`),
   - `src/app/(app)/san-pham/product-actions.tsx` (`SyncCostsButton`, `MapSkuForm` — client components, already done),
   - `src/modules/fulfillment/reasons.ts`, `src/modules/fulfillment/paste.ts`, `src/modules/fulfillment/milestones.ts` (pure functions),
   - `src/components/ui.tsx`, `src/lib/format.ts`, `src/lib/current-user.ts` (`pageUser`), `src/lib/db.ts` (`bindTenant` ONLY).
3. Examples to copy the style from EXACTLY: `src/app/(app)/khach-hang/page.tsx` (filters form, table, paging text),
   `src/app/(app)/khach-hang/[id]/page.tsx` (detail header), `tests/reports-period.test.ts` (table tests).

## 2. Hard rules

You MUST:
- Create/modify ONLY the files in your brief. Pages are async server components: `const user = await pageUser("product.view"); bindTenant(user);`
  then call the service. Never import `db`, `rootDb`, `workspaceDb`, `@prisma/client` values; never query the database yourself.
- Money only when the service returns it (it returns `null` without permission): print with `money(value, currency)` from `@/lib/format`,
  `"—"` when null. Stock numbers with `num()`.
- Low stock: a variant/market is low when its market code is in `variant.low`. Show it with `<Badge tone="warning">` (never raw colours).
  Unknown stock (`null`) → `"—"`; `variant.known === false` → small muted text "Mua hàng chưa có SKU này".
- Vietnamese copy with diacritics; no raw hex colours; no new shared components; tables use `<caption className="sr-only">` and `scope="col"`.
- Run `npx tsc --noEmit` until exit 0 (max three rounds), then `python -I ai-jobs/p10-fulfillment/checker.py <job> .` until `checker: OK`.

You MUST NOT: edit any other file; git; npm install; build; dev server; network; invent fields.

## 3. Briefs

### 3.1 `product-pages` — /san-pham list + /san-pham/[id] detail

- Outputs: `src/app/(app)/san-pham/page.tsx` (replace the existing Phase 2 page completely) and `src/app/(app)/san-pham/[id]/page.tsx` (new).
- **List** (`searchParams: Promise<Record<string, string | string[] | undefined>>`): `const f = productFilter.parse(flatten(await searchParams))` (take the first
  value of arrays), `const [data, unmatched] = await Promise.all([listProducts(user, f), unmatchedSkus(user)])`.
  - `PageHeader` title "Sản phẩm", crumbs Bán hàng / Sản phẩm, description: "Danh mục chung của team. Giá vốn và tồn khả dụng đọc từ Mua hàng (PurchasingLink, chỉ đọc); mã SKU của từng nền tảng ánh xạ về biến thể ở đây."
    Actions: `<SyncCostsButton pending={data.summary.costDiffers} />` only when `data.canSync`.
  - StatCards (grid like khach-hang): Sản phẩm (`summary.products`), Biến thể (SKU) (`summary.variants`), Tồn thấp (sum of `summary.lowByMarket` values,
    hint lists `AE 3 · KW 1` for markets with > 0, link `?low=1`), Mã nguồn chưa khớp (`summary.unmatchedSkus`, link `#chua-khop`), and when `data.showMoney`
    Giá vốn lệch Mua hàng (`summary.costDiffers`).
  - GET filter form: Tìm (q, placeholder "Tên, mã sản phẩm hoặc SKU"), Brand (select from `data.brands`, value id, label code), Thị trường (select from
    `data.markets`), checkbox "Chỉ tồn thấp" (name low, value 1), buttons Lọc / Đặt lại (link `/san-pham`).
  - Table: one row per variant, grouped by product (first variant row shows product name as link to `/san-pham/{id}` + brand code + category, use `rowSpan`).
    Columns: Sản phẩm, SKU (mono) + attributes joined " / ", one column per `data.markets` code (header = code, stock number, warning Badge "Thấp" when low),
    Dòng đơn (`sold`), Ánh xạ nguồn (`mappings`), and when `data.showMoney`: Giá vốn CRM (`cost`/`costCurrency`), Giá vốn Mua hàng (`purchasingCost`/`purchasingCurrency`)
    with `<Badge tone="info">Lệch</Badge>` when `costDiffers`.
  - Empty state when `data.rows.length === 0`: with filters "Không có sản phẩm khớp bộ lọc" (+ link Đặt lại), otherwise "Chưa có sản phẩm" / "Chạy npm run db:seed-demo để nạp danh mục mẫu.".
  - Paging text + prev/next links when `data.total > data.pageSize` (keep other params).
  - Section `id="chua-khop"` "Mã nguồn chưa khớp" (`SectionTitle`): table Mã nguồn (mono), Tên trên đơn, Số dòng đơn, and when `data.canMap` a column Gắn vào biến thể with
    `<MapSkuForm sourceSku={r.sourceSku} variants={data.variantOptions} />`. Empty: "Mọi mã SKU trong đơn đều đã khớp danh mục."
  - Footer muted line: `Dữ liệu Mua hàng lúc ${dateTime(data.asOf)} · ngưỡng tồn thấp mặc định ${DEFAULT_LOW_STOCK} đơn vị mỗi thị trường (đổi ở Cấu hình).` (`asOf` may be null → "chưa có").
- **Detail** (`params: Promise<{ id: string }>`): `getProduct(user, id)`; when it throws an error whose `status === 404` call `notFound()`.
  - `PageHeader` title = name, crumbs Bán hàng / Sản phẩm (href `/san-pham`) / code; description: nameEn · nameAr · brand name · category; Badge "Ngừng bán" when `!active`.
  - Table "Biến thể": SKU + attributes, one column per `markets` (stock + warning Badge when low), Bán 90 ngày (`qty90`, hint "đã giao {delivered90}"),
    and when `showMoney` Giá vốn CRM / Giá vốn Mua hàng (Badge "Lệch" when `costDiffers`).
  - Table "Mã nguồn đã ánh xạ": Biến thể (SKU), Kết nối (`connection`), Mã nguồn (mono) — one row per `variants[].sources[]`; empty text "Chưa có mã nguồn nào ánh xạ vào sản phẩm này.".
  - Muted footer with `asOf` like the list.

### 3.2 `p10-tests` — table tests for the Phase 10 pure functions

- Output: `tests/fulfillment-pure.test.ts` (vitest), importing from `@/modules/fulfillment/reasons`, `@/modules/fulfillment/paste`, `@/modules/fulfillment/milestones`.
- `it.each` tables:
  - `normalizeReason`: canonical codes kept; null/empty/whitespace → null; English/Vietnamese (with and without diacritics)/Arabic/French/German phrases for each
    code; upper-case and underscore variants ("CUSTOMER_REFUSED"); unknown text → "other"; the "wrong address" phrase wins over generic words.
  - `CUSTOMER_FAILURE_REASONS` equals exactly customer_refused, unreachable, wrong_address; `reasonLabel(null)` = "Không rõ lý do"; unknown code returns itself.
  - `parseAmount`: "163", "160,00", "1,234.50", "1.234,50", "1 234,5", "13.200" (KWD three decimals → "13.200"), "AED 99", "007", "-5" → null, "abc" → null, "" → null, "1.2.3" → null.
  - `parseDay`: dd/mm/yyyy, yyyy-mm-dd, with time, ISO with Z, 29/02/2028 valid, 29/02/2026 → null, 31/04/2026 → null, 25:00 → null, garbage → null (compare `toISOString()`).
  - `parseSettlementPaste`: tab and comma separators, header aliases (Mã vận đơn / AWB / Số tiền / Ngày về / tiền tệ), blank lines skipped and rowNo kept as in the source,
    BOM stripped, missing required column → `PasteError`, header only → `PasteError`, 501 data rows → `PasteError`.
  - `addDec`: sums with 4 decimals, negatives, trailing zeros trimmed ("160.00" + "0" → "160").
  - `codSteps`: non-COD → null; booked only; delivered + collected; remitted with reference note; partial (2 COD shipments, 1 collected → "partial");
    failed shipment → delivered "failed" and collected/remitted "skipped"; cancelled order → booked "failed".
  At least 50 rows, fixed dates only. Expected values MUST follow the code; list any doubt (do not change the code).

## 4. Report back

Job id, files written, last line of tsc and checker, doubts.
