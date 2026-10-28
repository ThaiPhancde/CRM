# Ví dụ chuẩn — /api-readiness (go-live gate)

> Mẫu `/api-readiness food-delivery` (PayGate). File `docs/food-delivery/integration/api-readiness.md`. Học: mỗi ✅ có bằng chứng; blocker (`.bru.todo`, OQ-1 tiền) làm **No-Go** trung thực; phải có rollback + degraded-UX; secret production tách sandbox.

---

```markdown
## Bảng Go / No-Go
| Hạng mục | Trạng thái | Bằng chứng / việc còn thiếu |
|---|---|---|
| Cutover plan | ✅ | Kế hoạch chuyển env 22:00, có người trực |
| Feature flag | ✅ | Flag `paygate_online` rollout 10% trước |
| Monitoring | ✅ | Alert tỉ lệ FAILED > 5%, webhook trễ > 60s |
| Rollback + degraded-UX | ✅ | Tắt flag → fallback COD (E-food-delivery-004) đã thử |
| Test pass | ❌ | Còn ACHK-006 (Get Payment đối soát) là .bru.todo — chưa có id sandbox |
| Secret production | ❌ | PAYGATE_KEY production chưa cấp (còn sandbox) |
| OQ tiền/đơn đã chốt | ❌ | OQ-1 timeout chờ kết quả CHƯA chốt |

**Kết luận:** **NO-GO** — blocker: (1) OQ-1 timeout chưa chốt (rủi ro đơn treo), (2) test đối soát còn todo, (3) secret production chưa cấp.
**Người duyệt:** Trưởng nhóm thanh toán — 2026-07-27
```

---

**Vì sao mẫu này tốt:** (1) Mỗi ✅ có **bằng chứng thật** (flag, alert, đã thử rollback). (2) **Không tick khống**: còn `.bru.todo` + secret sandbox + OQ-1 → **❌ trung thực**. (3) Kết luận **NO-GO** với blocker rõ — gate an toàn tiền/đơn đúng nghĩa (không "làm đẹp" thành Go). (4) **Rollback + degraded-UX** bám E-food-delivery-004 (fallback COD) — có đường lui. (5) Secret production **tách sandbox**, không in key. (6) OQ-1 (timeout) được coi là **blocker tiền** — kế thừa đúng từ SRS.
