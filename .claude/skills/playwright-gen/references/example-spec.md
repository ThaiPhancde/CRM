# Ví dụ chuẩn — /playwright-gen (plan → engine → spec)

> Minh hoạ đầy đủ luồng `/playwright-gen` cho `food-delivery`: từ **test case** → skill dựng **plan** (`example-plan.json` cạnh file này) + **selectors.json** → **engine** `playwright-gen.mjs` sinh `.spec.ts`. Học: BA KHÔNG bịa selector — key chưa map → engine tự `test.fixme()` (không giả-pass).

---

## 1. Skill dựng plan (từ test case TC-001..003, TC-010..011)

Xem `example-plan.json`. Mỗi test case → 1 `scenario` (giữ `id`, `tags` = `@TC`/`@type`/`@priority`/`@AC`/`@E`); Steps+Expected map sang **action vocabulary** (`goto/click/expectText/expectDisabled/note`...). Nhóm theo màn → mỗi `spec` 1 `scope` (`ordering`, `payment`).

## 2. selectors.json (dev điền — BA để trống key mới)

```json
{
  "place-order-btn": "[data-testid=place-order]",
  "order-status": "[data-testid=order-status]",
  "order-code": "[data-testid=order-code]",
  "toast-error": ".toast--error",
  "pay-cod": "[data-testid=pay-cod]",
  "pay-online": "[data-testid=pay-online]",
  "confirm-pay": "[data-testid=confirm-pay]"
}
```
> `min-order-note` CỐ Ý chưa map → scenario dùng nó (TC-003) sẽ thành `test.fixme()`.

## 3. Chạy engine

```bash
node .claude/scripts/playwright-gen.mjs --dir docs/food-delivery/test/e2e
# PWGEN-OK: feature=food-delivery | specs=2 scenarios=5 fixme=1 | out=.../specs
```

## 4. Spec sinh ra — `specs/ordering.spec.ts` (trích)

```ts
// AUTO-GENERATED bởi playwright-gen.mjs — KHÔNG sửa tay.
import { test, expect } from '@playwright/test';

test.describe('Đặt món từ menu (US-001)', () => {
  test('TC-001 Đặt đơn thành công @happy @P0 @AC-001', async ({ page }) => {
    // Given khách đã đăng nhập, nhà hàng mở cửa, giỏ có món còn bán, tổng >= 30.000d
    await page.goto('/cart');
    await page.locator('[data-testid=place-order]').click();
    await expect(page.locator('[data-testid=order-status]')).toContainText('Chờ nhà hàng xác nhận');
    await expect(page.locator('[data-testid=order-code]')).toBeVisible();
  });

  test('TC-003 Dưới giá trị tối thiểu @boundary @BR-food-delivery-001 @AC-004', async ({ page }) => {
    // TODO: selector chưa map — điền vào selectors.json rồi chạy lại /playwright-gen:
    //   - min-order-note
    test.fixme();
    await page.goto('/cart');
    await expect(page.locator('[data-testid=place-order]')).toBeDisabled();
    await expect(page.locator('TODO-SELECTOR:min-order-note')).toContainText('Đơn tối thiểu 30.000đ');
  });
});
```

---

**Vì sao mẫu này tốt:** (1) **Tách vai đúng**: skill dựng plan (hiểu nghiệp vụ), engine sinh TS (deterministic) — `.spec.ts` luôn regen được, không drift. (2) **Không bịa selector**: BA để `selectors.json` cho dev; key chưa map (`min-order-note`) → `test.fixme()` + TODO rõ ràng, **KHÔNG giả-pass**. (3) **Trace giữ nguyên** qua tag (`@TC-001 @AC-001 @E-food-delivery-004`). (4) `expectText` dùng **wording exact** từ Expected/Error Matrix. (5) Header cảnh báo "KHÔNG sửa tay" — sửa test case rồi chạy lại.
