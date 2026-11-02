"""Checker for ai-jobs/p10-fulfillment jobs. Stdlib only.   python -I checker.py <job-id> <repo-root>"""
import re
import sys
from pathlib import Path

PAGES = ["src/app/(app)/san-pham/page.tsx", "src/app/(app)/san-pham/[id]/page.tsx"]
MUST = [r"listProducts\(", r"productFilter\.parse", r"unmatchedSkus\(", r"getProduct\(", r"SyncCostsButton", r"MapSkuForm", r"notFound\(",
        r"variantOptions", r"lowByMarket", r"costDiffers", r"showMoney", r'id="chua-khop"', r"DEFAULT_LOW_STOCK", r"Mua hàng chưa có SKU này",
        r'tone="warning"', r"sources", r"qty90", r'scope="col"', r"sr-only"]
FORBIDDEN = [r"\brootDb\b", r"\bworkspaceDb\b", r"\bdb\.", r"import \{[^}]*\bdb\b[^}]*\} from \"@/lib/db\"", r"from \"@prisma/client\"", r"#[0-9a-fA-F]{6}\b",
             r"dangerouslySetInnerHTML", r"\.toFixed\(", r"text-(red|green|yellow|orange)-\d"]
VI = re.compile(r"[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]", re.I)


def main():
    job, root = sys.argv[1], Path(sys.argv[2] if len(sys.argv) > 2 else ".")
    errors = []
    if job == "product-pages":
        text = ""
        for f in PAGES:
            p = root / f
            if not p.is_file():
                errors.append(f"missing {f}")
                continue
            t = p.read_text(encoding="utf-8")
            text += t
            for pat in FORBIDDEN:
                if re.search(pat, t):
                    errors.append(f"{f}: forbidden {pat}")
            if "bindTenant(user)" not in t:
                errors.append(f"{f}: must call bindTenant(user)")
            if 'pageUser("product.view")' not in t:
                errors.append(f"{f}: must call pageUser(\"product.view\")")
            if len(VI.findall(t)) < 20:
                errors.append(f"{f}: too little Vietnamese copy")
        for pat in MUST:
            if not re.search(pat, text):
                errors.append(f"missing required usage {pat}")
    elif job == "p10-tests":
        p = root / "tests/fulfillment-pure.test.ts"
        if not p.is_file():
            errors.append("missing tests/fulfillment-pure.test.ts")
        else:
            t = p.read_text(encoding="utf-8")
            for mod in ("@/modules/fulfillment/reasons", "@/modules/fulfillment/paste", "@/modules/fulfillment/milestones"):
                if mod not in t:
                    errors.append(f"must import from {mod}")
            for fn in ("normalizeReason", "CUSTOMER_FAILURE_REASONS", "reasonLabel", "parseAmount", "parseDay", "parseSettlementPaste", "PasteError", "addDec", "codSteps"):
                if fn not in t:
                    errors.append(f"no test for {fn}")
            for k in ("13.200", "29/02/2028", "29/02/2026", "partial", "skipped", "رفض", "\\uFEFF"):
                if k not in t:
                    errors.append(f"missing case containing {k}")
            if len(re.findall(r"\b(it|test)\.each", t)) < 6:
                errors.append("use it.each tables (>= 6)")
            if len(re.findall(r"^\s*\[", t, re.M)) < 50:
                errors.append("too few table rows (< 50)")
            if re.search(r"new Date\(\)", t):
                errors.append("use fixed dates, not new Date()")
    else:
        print(f"unknown job {job}")
        sys.exit(2)
    if errors:
        for e in errors[:60]:
            print("FAIL", e)
        print(f"checker: {len(errors)} error(s)")
        sys.exit(1)
    print(f"checker: OK {job}")


if __name__ == "__main__":
    main()
