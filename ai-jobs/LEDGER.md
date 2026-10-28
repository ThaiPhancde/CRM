# Ledger — one row per batch

A rule moves from hypothesis to pillar only on the evidence recorded here. Write down how the
"Claude does it alone" estimate was made, in the Notes section below the table.

| # | Date | Kind of work | Jobs | Model, mode | Time | Validator (run by Claude) | Stray writes | Review defects | Claude tokens (actual / alone estimate) |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 2026-10-28 | p2-catalog: danh mục sản phẩm hư cấu vi/en/ar (42 sp, 67 SKU) | 1 | gemini-4-argon-medium, write | 152 s | checker exit 0 (runner `check` + Claude chạy lại) | 0 | 0 sửa | ~6k (work order + checker + review) / ~9k |

## Notes

1. Batch 1: checker bắt hình dạng, trùng mã, giá khớp tỷ giá ±20%, tiếng Việt có dấu, tiếng Ả Rập cho LUMI/NOVA. Claude đọc toàn bộ 42 tên: không nhãn hiệu thật, không lời chữa bệnh; "Vitamin C 10%", "Hyaluronic" là tên thành phần, giữ. Ước tính "Claude tự làm" = viết 42 sản phẩm × 3 ngôn ngữ + giá 5 tiền tệ ≈ 9k token đầu ra; thực tế Claude tốn cho work order (~2k), checker (~2.5k), review (~1.5k). Lợi thế chính ở phần tiếng Ả Rập.
