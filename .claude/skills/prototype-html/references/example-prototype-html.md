# Ví dụ chuẩn — /prototype-html

> Mẫu output `/prototype-html` cho `food-delivery` (mobile 375). File `html-design/food-delivery-prototype.html` — self-contained, click-through. Học: design tokens `:root`, mỗi screen 1 `<section id>`, JS điều hướng **bám transitions userflow Mục 3.5**, wording lỗi thật, KHÔNG CDN.

---

## Trích cấu trúc

```html
<style>
  :root{ --brand:#e8552d; --bg:#f4f5f7; --card:#fff; --err:#c0392b; --radius:10px; }
  .device{width:375px;...}          /* khung mobile 375 */
  .screen{display:none} .screen.active{display:block}
  .form{max-width:320px;margin:0 auto}   /* form căn giữa khung hẹp (Mục 8) */
</style>

<section id="checkout" class="screen">
  <label class="radio"><input type="radio" name="pay" value="cod" checked> Tiền mặt khi nhận (COD)</label>
  <label class="radio"><input type="radio" name="pay" value="online"> Thanh toán online</label>
  <button class="btn" onclick="confirmPay()">Xác nhận</button>
</section>

<section id="checkout-error" class="screen">
  <div class="banner">Thanh toán không thành công, vui lòng thử lại hoặc chọn COD.</div>
</section>

<script>
  function confirmPay(){
    var v=document.querySelector('input[name="pay"]:checked').value;
    go(v==='online' ? 'checkout-error' : 'order-tracking');  // theo transitions Mục 3.5
  }
</script>
```

---

**Vì sao mẫu này tốt:** (1) **Self-contained** — CSS + JS inline, **KHÔNG CDN/external**, mở offline demo được. (2) **Design tokens** (`:root` CSS variables) → màu/spacing nhất quán, hi-fi nhưng không loè loẹt. (3) **Điều hướng bám transitions userflow Mục 3.5** — `confirmPay()` chọn màn đích theo COD/online đúng bảng transitions, KHÔNG tự đoán. (4) Mỗi screen 1 `<section id="{slug}">` khớp slug wireframe-index (deep-link `#checkout`). (5) **Wording lỗi exact** từ Error Matrix (E-food-delivery-004). (6) `<input>`/`<button>` element thật (khác ASCII), form căn giữa khung hẹp (Mục 8). (7) State loại trừ (`checkout-error`) là screen riêng.
