# CRM LevelUp (bản demo)

CRM nội bộ cho các team của LevelUp: khách hàng, đơn từ nhiều nền tảng bán, chăm sóc, insight và AI. Giai đoạn **demo** — mọi hệ thống ngoài (Pancake, Shopify, BigQuery, LLM, email) chạy giả lập qua adapter. Thiết kế: `Thiet_ke_CRM_va_prompt_Claude.md`; hướng dẫn cho agent: `AGENTS.md`; tài liệu: `docs/` (bắt đầu từ `docs/handoff.md`).

Stack: Next.js 15 · TypeScript · PostgreSQL · Prisma 6 · Tailwind 4.

## Chạy lần đầu

Cần Node ≥ 20 và PostgreSQL.

```bash
npm install
cp .env.example .env            # điền mật khẩu DB, SESSION_SECRET ≥ 32 ký tự
createdb crm && createdb crm_test
npx prisma migrate deploy
npm run db:seed                 # 2 team mẫu, danh mục, 9 người mẫu đủ vai
npm run db:seed-demo            # sản phẩm + kết nối 5 shop + 12 tháng đơn phát lại (~2 phút)
npx next dev -p 3217            # http://localhost:3217 → /dang-nhap
npm run worker                  # (tùy chọn) worker đồng bộ theo chu kỳ, tiến trình riêng
```

## Kiểm thử

```bash
npm run typecheck
npm test                        # chạy trên TEST_DATABASE_URL, không chạm DB chính
python -I tools/agy-runner/test_run_agy.py   # runner giao việc Gemini
```
