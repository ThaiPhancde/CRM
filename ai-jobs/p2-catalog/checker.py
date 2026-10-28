"""Checker for fixtures/catalog.json (p2-catalog). Stdlib only. Exit 0 = shape and numbers OK.

    python checker.py <repo-root>

Checks shape, uniqueness, counts, decimal formats, and that every price is consistent with the fixed demo FX
table (docs/demo-strategy.md / prisma/seed.ts) within +-20%. It cannot check that names are good; Claude reads those.
"""
import json
import re
import sys
from decimal import Decimal
from pathlib import Path

FX = {"USD": Decimal("1"), "EUR": Decimal("1.08"), "AED": Decimal("0.27229"), "SAR": Decimal("0.26667"), "KWD": Decimal("3.25")}
BRANDS = {"LUMI", "NOVA", "ORBI"}
NEEDS_AR = {"LUMI", "NOVA"}  # sold in the Middle East
SKU_RE = re.compile(r"^(LUMI|NOVA|ORBI)-[A-Z0-9]{2,8}-[A-Z0-9]{1,6}$")
CODE_RE = re.compile(r"^(LUMI|NOVA|ORBI)-[A-Z0-9]{2,8}$")
ARABIC_RE = re.compile(r"[؀-ۿ]")
VI_RE = re.compile(r"[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]", re.I)


def fail(errors):
    for e in errors[:40]:
        print("FAIL", e)
    print(f"checker: {len(errors)} error(s)")
    sys.exit(1)


def main():
    root = Path(sys.argv[1] if len(sys.argv) > 1 else ".")
    path = root / "fixtures" / "catalog.json"
    if not path.is_file():
        fail([f"missing {path}"])
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except ValueError as exc:
        fail([f"invalid JSON: {type(exc).__name__}"])
    errors = []
    products = data.get("products") if isinstance(data, dict) else None
    if not isinstance(products, list):
        fail(["top level must be {\"products\": [...]}"])
    per_brand = {b: 0 for b in BRANDS}
    codes, skus = set(), set()
    for i, p in enumerate(products):
        at = f"products[{i}]"
        if not isinstance(p, dict):
            errors.append(f"{at}: not an object")
            continue
        extra = set(p) - {"code", "brand", "category", "name_vi", "name_en", "name_ar", "variants"}
        if extra:
            errors.append(f"{at}: unknown keys {sorted(extra)}")
        brand = p.get("brand")
        if brand not in BRANDS:
            errors.append(f"{at}: brand must be one of {sorted(BRANDS)}")
            continue
        per_brand[brand] += 1
        code = p.get("code", "")
        if not isinstance(code, str) or not CODE_RE.match(code) or not code.startswith(brand + "-"):
            errors.append(f"{at}: bad code {code!r}")
        if code in codes:
            errors.append(f"{at}: duplicate code {code}")
        codes.add(code)
        for k in ("category", "name_vi", "name_en"):
            if not isinstance(p.get(k), str) or not p[k].strip() or len(p[k]) > 80:
                errors.append(f"{at}.{k}: required string <= 80 chars")
        if isinstance(p.get("name_vi"), str) and not VI_RE.search(p["name_vi"]):
            errors.append(f"{at}.name_vi: must be Vietnamese with diacritics")
        if brand in NEEDS_AR:
            if not isinstance(p.get("name_ar"), str) or not ARABIC_RE.search(p["name_ar"]):
                errors.append(f"{at}.name_ar: Arabic name required for {brand}")
        elif "name_ar" in p:
            errors.append(f"{at}.name_ar: only LUMI and NOVA have Arabic names")
        variants = p.get("variants")
        if not isinstance(variants, list) or not 1 <= len(variants) <= 3:
            errors.append(f"{at}.variants: 1..3 items")
            continue
        for j, v in enumerate(variants):
            vat = f"{at}.variants[{j}]"
            if not isinstance(v, dict) or set(v) != {"sku", "attributes", "prices", "cost_usd"}:
                errors.append(f"{vat}: keys must be exactly sku, attributes, prices, cost_usd")
                continue
            sku = v["sku"]
            if not isinstance(sku, str) or not SKU_RE.match(sku) or not sku.startswith(code + "-"):
                errors.append(f"{vat}: sku {sku!r} must be <product code>-<suffix>")
            if sku in skus:
                errors.append(f"{vat}: duplicate sku {sku}")
            skus.add(sku)
            if not isinstance(v["attributes"], dict) or not all(isinstance(x, str) for x in v["attributes"].values()):
                errors.append(f"{vat}.attributes: object of strings")
            prices = v["prices"]
            if not isinstance(prices, dict) or set(prices) != set(FX):
                errors.append(f"{vat}.prices: keys must be exactly {sorted(FX)}")
                continue
            try:
                usd = Decimal(prices["USD"])
                cost = Decimal(v["cost_usd"])
            except Exception:
                errors.append(f"{vat}: prices/cost must be decimal strings")
                continue
            if not (Decimal("3") <= usd <= Decimal("900")):
                errors.append(f"{vat}: USD price out of range 3..900")
            if not (Decimal("0.15") * usd <= cost <= Decimal("0.7") * usd):
                errors.append(f"{vat}: cost_usd must be 15%..70% of USD price")
            for cur, rate in FX.items():
                s = prices[cur]
                places = 3 if cur == "KWD" else 2
                if not isinstance(s, str) or not re.fullmatch(rf"\d+\.\d{{{places}}}", s):
                    errors.append(f"{vat}.prices.{cur}: string with exactly {places} decimals")
                    continue
                implied = Decimal(s) * rate
                if not (usd * Decimal("0.8") <= implied <= usd * Decimal("1.2")):
                    errors.append(f"{vat}.prices.{cur}: {s} is not within 20% of USD {usd} at rate {rate}")
    for b, n in per_brand.items():
        if not 12 <= n <= 16:
            errors.append(f"brand {b}: {n} products, need 12..16")
    if errors:
        fail(errors)
    print(f"checker: OK products={len(products)} skus={len(skus)}")


if __name__ == "__main__":
    main()
