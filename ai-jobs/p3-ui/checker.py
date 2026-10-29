"""Checker for ai-jobs/p3-ui jobs. Stdlib only.   python -I checker.py <job-id> <repo-root>

Checks files exist, view files never touch the database layer, Vietnamese copy is present, required contract calls and
permission guards are used. Type safety is checked separately by `npx tsc --noEmit`. It cannot judge design quality;
Claude reviews that.
"""
import re
import sys
from pathlib import Path

JOBS = {
    "list": {"files": ["src/app/(app)/khach-hang/page.tsx"], "must": [r"listCustomers\(", r"parseCustomerFilter\(", r'pageUser\("customer\.view"\)', r"EmptyState", r"<caption"]},
    "profile": {"files": ["src/app/(app)/khach-hang/[id]/page.tsx"], "dir": "src/app/(app)/khach-hang/[id]", "must": [r"getCustomer360\(", r"redirectTo", r"notFound\(", r"recordPreferenceAction", r"unmergeCustomerAction", r"Chưa đủ dữ liệu", r"tab"]},
    "review": {"files": ["src/app/(app)/xac-minh/page.tsx", "src/app/(app)/xac-minh/customer-reviews.tsx"], "must": [r"listCustomerReviews\(", r"mergeCustomerAction", r"rejectCustomerReviewAction", r"customer\.merge", r"order\.link", r"listReviews\("]},
    "phone": {"files": ["tests/phone.test.ts"], "must": [r"normalizePhone", r"maskPhone", r"maskEmail", r"it\.each|test\.each"]},
}
FORBIDDEN = [r'from "@/lib/db"', r'from "@prisma/client"', r"rootDb", r"workspaceDb"]
VI = re.compile(r"[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]", re.I)
COUNTRIES = ["VN", "US", "DE", "FR", "AE", "SA", "KW"]


def main():
    job, root = sys.argv[1], Path(sys.argv[2] if len(sys.argv) > 2 else ".")
    spec = JOBS.get(job)
    if not spec:
        print(f"unknown job {job}")
        sys.exit(2)
    errors = []
    files = [root / f for f in spec["files"]]
    if "dir" in spec:
        files += [p for p in (root / spec["dir"]).glob("*.tsx") if p not in files]
    text = ""
    for p in files:
        if not p.is_file():
            errors.append(f"missing {p.relative_to(root)}")
            continue
        t = p.read_text(encoding="utf-8")
        text += t
        if job != "phone":
            for pat in FORBIDDEN:
                if re.search(pat, t):
                    errors.append(f"{p.relative_to(root)}: forbidden {pat} (use the service contract)")
            if len(VI.findall(t)) < 20:
                errors.append(f"{p.relative_to(root)}: too little Vietnamese copy")
            if re.search(r"#[0-9a-fA-F]{6}\b", t):
                errors.append(f"{p.relative_to(root)}: raw hex color; use design tokens")
    for pat in spec["must"]:
        if not re.search(pat, text):
            errors.append(f"missing required usage {pat}")
    if job == "phone":
        for cc in COUNTRIES:
            if len(re.findall(rf'"{cc}"', text)) < 3:
                errors.append(f"phone: too few cases mentioning default country \"{cc}\"")
    if errors:
        for e in errors:
            print("FAIL", e)
        print(f"checker: {len(errors)} error(s)")
        sys.exit(1)
    print(f"checker: OK {job}")


if __name__ == "__main__":
    main()
