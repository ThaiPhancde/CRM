# 01 — Work order: demo product catalog (Gemini, headless `agy -p`)

> Written 2026-10-28 by Claude (brain). Owner ruling: user asked (2026-10-28) to combine Antigravity with Claude leading ~80/20.
> Executor: one headless `agy -p` run through `run_agy.py` (`gemini-4-argon-medium`, mode `write`).
> Acceptance: Claude, never the executor's own report (section 6).

## 1. What you are producing

One JSON file, `fixtures/catalog.json`: a FICTIONAL product catalog for a demo CRM. It feeds a deterministic script that
generates 12 months of fake orders, and the CRM screens show these product names. Three fictional brands of one team:

| brand code | brand name | what it sells | markets |
|---|---|---|---|
| LUMI | Lumi Home | home & kitchen gadgets (storage, lamps, small kitchen tools) | UAE, Saudi Arabia, Kuwait |
| NOVA | Nova Beauty | skincare and beauty tools | USA, UAE |
| ORBI | Orbi Living | furniture and home decor | Germany, France |

Read before working, in this order (only these):
1. This file.
2. `ai-jobs/p2-catalog/checker.py` — the exact rules your file must pass.

## 2. Hard rules

You MUST:
- Write exactly one new file, `fixtures/catalog.json`, and nothing else.
- Top level: `{"products": [ ... ]}`. 12 to 16 products per brand (LUMI, NOVA, ORBI).
- Each product: `code` (e.g. `LUMI-LAMP01`, pattern `<BRAND>-<2..8 A-Z0-9>`), `brand`, `category` (English, short),
  `name_vi` (natural Vietnamese WITH diacritics), `name_en`, `name_ar` (natural Arabic, ONLY for LUMI and NOVA; omit for ORBI),
  `variants` (1 to 3).
- Each variant: `sku` = `<product code>-<1..6 A-Z0-9>` (e.g. `LUMI-LAMP01-WH`), `attributes` (object of strings, e.g.
  `{"color": "white"}` or `{"size": "50ml"}`), `prices` with EXACTLY the keys USD, EUR, AED, SAR, KWD as decimal strings
  (2 decimals; KWD 3 decimals), `cost_usd` (decimal string, 15%..70% of the USD price).
- Prices per currency must match the USD price at these fixed rates (1 unit = X USD) within 20%:
  USD 1, EUR 1.08, AED 0.27229, SAR 0.26667, KWD 3.25. Round to "nice" retail prices (e.g. 79.00 AED, 21.900 KWD).
- Run `python ai-jobs/p2-catalog/checker.py .` from the repository root and fix your file until it prints `checker: OK`
  (at most three rounds).

You MUST NOT:
- Edit, create or delete any other file. No git, no npm, no build, no network fetches.
- Use real brand names, trademarks, real people or real product model numbers. Everything is invented.
- Make medical or health claims in names (no "cures", "anti-aging treatment"); plain product names only.

## 3. Style

Names a shopper would see on a store page: short (2 to 6 words), specific, no marketing hype, no emoji.
Vietnamese and Arabic names are natural translations, not transliterations. Example of one product:

```json
{"code": "LUMI-LAMP01", "brand": "LUMI", "category": "Lighting",
 "name_vi": "Đèn ngủ cảm biến chuyển động", "name_en": "Motion Sensor Night Light", "name_ar": "مصباح ليلي بمستشعر حركة",
 "variants": [{"sku": "LUMI-LAMP01-WH", "attributes": {"color": "white"},
   "prices": {"USD": "19.90", "EUR": "18.50", "AED": "73.00", "SAR": "75.00", "KWD": "6.100"}, "cost_usd": "6.20"}]}
```

## 4. Brief

- Output: `fixtures/catalog.json`
- Sources you may use: only this work order.
- Spread prices: LUMI mostly 8–60 USD, NOVA 10–80 USD, ORBI 40–600 USD.
- Spread categories: at least 4 different categories per brand.

## 5. Report back (your final reply)

Output path, the checker's last output line, product count per brand, and anything you could not do.

## 6. Acceptance (Claude, not the executor)

1. `run_agy.py` exit 0: no job error, no timeout, no `stray_write`.
2. Claude runs `python ai-jobs/p2-catalog/checker.py <worktree>` and it exits 0.
3. Claude reads every name (vi/en/ar spot-check) for nonsense, real trademarks, or health claims.
4. Copy into the main repo, `npm test`, commit.
5. One row in `ai-jobs/LEDGER.md`.

## 7. Result

(Filled in by Claude after acceptance.)
