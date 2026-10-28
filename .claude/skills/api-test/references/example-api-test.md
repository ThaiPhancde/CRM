# Ví dụ chuẩn — /api-test (sinh Bruno từ plan)

> Mẫu `/api-test food-delivery` (PayGate). BA soạn `bruno/plan.json` + `vars.json`, engine sinh `.bru`. Học: request đủ URL+assert → `.bru` chạy được; thiếu URL sandbox → `.bru.todo` (không false-pass); secret qua `{{process.env.*}}`.

---

## bruno/plan.json (BA soạn)

```json
{
  "collection": "food-delivery-paygate",
  "requests": [
    {
      "name": "Create Payment thành công", "seq": 1,
      "method": "post", "url": "{{baseUrl}}/v1/payments",
      "layer": "3rd", "direction": "out", "source": "ACHK-001",
      "headers": { "Authorization": "Bearer {{apiKey}}", "Idempotency-Key": "{{orderId}}" },
      "body": { "orderId": "{{orderId}}", "amount": 5000000, "method": "CARD" },
      "asserts": ["res.status: eq 201", "res.body.status: eq PENDING"]
    },
    {
      "name": "Get Payment đối soát", "seq": 2,
      "method": "get", "url": "", "layer": "3rd", "direction": "out",
      "source": "ACHK-006", "todo_reason": "chưa có id giao dịch sandbox thật (OQ-1)"
    }
  ]
}
```

## vars.json

```json
{ "name": "sandbox", "vars": {
  "baseUrl": "https://sandbox.paygate.example/api",
  "apiKey": "{{process.env.PAYGATE_KEY}}",
  "orderId": "" } }
```

## Kết quả engine

```
APIGEN-OK: requests=2 bru=1 todo=1
→ 01-create-payment-thanh-cong.bru        (chạy được)
→ 02-get-payment-doi-soat.bru.todo        (Bruno KHÔNG chạy — chưa có id thật)
```

---

**Vì sao mẫu này tốt:** (1) BA soạn **plan.json** (khai báo), engine sinh `.bru` — không viết `.bru` tay. (2) `amount: 5000000` = 50.000đ ×100 (khớp transform api-map — **đúng đơn vị cent**). (3) `Idempotency-Key = orderId` (an toàn gọi lại). (4) Request thiếu URL/id thật → **`.bru.todo`** (Bruno bỏ qua → **không xanh giả**), lý do ghi rõ (OQ-1). (5) Secret qua **`{{process.env.PAYGATE_KEY}}`** — không hardcode. (6) Mỗi request giữ `source: ACHK-*` để trace về checklist.
