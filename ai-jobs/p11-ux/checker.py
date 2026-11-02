"""Checker for ai-jobs/p11-ux jobs. Stdlib only.   python -I checker.py <job-id> <repo-root>"""
import re
import sys
from pathlib import Path

A = "src/app/(app)/"
CONFIRM = ["nhiem-vu/task-buttons.tsx", "xac-minh/buttons.tsx", "xac-minh/customer-reviews.tsx", "khach-hang/[id]/unmerge-button.tsx", "ai/approval-buttons.tsx",
           "ket-noi/view.tsx", "chien-dich/[id]/status-buttons.tsx", "quan-tri/diem/recompute-button.tsx", "hanh-trinh/[id]/status-buttons.tsx"]
COPY = ["page.tsx", "ai/page.tsx", "ai/[id]/page.tsx", "ai/conversation-panel.tsx", "chien-dich/page.tsx", "chien-dich/[id]/page.tsx", "chien-dich/[id]/touchpoint-form.tsx",
        "bao-cao/[nhom]/page.tsx", "bao-cao/[nhom]/sections/marketing.tsx", "bao-cao/[nhom]/sections/sales.tsx", "bao-cao/[nhom]/sections/van-don.tsx", "quan-tri/nguoi-dung/view.tsx",
        "quan-tri/chi-so/page.tsx", "quan-tri/vai-tro/page.tsx", "quan-tri/cau-hinh/page.tsx", "quan-tri/cau-hinh/forms.tsx", "quan-tri/danh-muc/view.tsx", "nhu-cau/page.tsx",
        "nhu-cau/create-lead.tsx", "nhu-cau/[id]/page.tsx", "nhu-cau/bulk-bar.tsx", "nhu-cau/[id]/claim-button.tsx", "nhiem-vu/page.tsx", "hang-doi/page.tsx",
        "hanh-trinh/[id]/page.tsx", "phan-khuc/page.tsx", "xac-minh/page.tsx"]
# Visible text: between > and < in JSX, or in label/placeholder/title/aria-label/description/header attributes.
VISIBLE = re.compile(r'>([^<>{}]*)<|(?:label|placeholder|title|aria-label|description|header)=\{?["`]([^"`]*)["`]')
BANNED = [r"\bLead\b", r"\blead\b", r"\bBrand\b", r"\bShop\b", r"Customer 360", r"frequency cap", r"\bPhase \d", r"\bD-\d\d\b", r"npm run", r"\breplay\b", r"\(args\)", r"\(payload\)"]


def main():
    job, root = sys.argv[1], Path(sys.argv[2] if len(sys.argv) > 2 else ".")
    errors = []
    if job == "confirm-modal":
        for f in CONFIRM:
            t = (root / A / f).read_text(encoding="utf-8")
            if re.search(r"(window\.)?\bconfirm\(", t):
                errors.append(f"{f}: still uses confirm()")
            if "ConfirmButton" not in t:
                errors.append(f"{f}: must use ConfirmButton")
        for f in ["xac-minh/buttons.tsx", "xac-minh/customer-reviews.tsx"]:
            if re.search(r'state\.message \?\? ""', (root / A / f).read_text(encoding="utf-8")):
                errors.append(f"{f}: empty toast fallback")
    elif job == "copy-a11y":
        for f in COPY:
            t = (root / A / f).read_text(encoding="utf-8")
            for m in VISIBLE.finditer(t):
                txt = m.group(1) or m.group(2) or ""
                for pat in BANNED:
                    if re.search(pat, txt):
                        errors.append(f"{f}: visible text still has {pat}: {txt.strip()[:60]!r}")
            if re.search(r'role="tab(list)?"', t):
                errors.append(f"{f}: link tabs must be nav + aria-current")
        cp = (root / A / "ai/conversation-panel.tsx").read_text(encoding="utf-8")
        if not re.search(r"<span aria-hidden[^>]*>✦", cp):
            errors.append("conversation-panel: decorative ✦ must be aria-hidden")
        if "MKT-02" not in (root / A / "bao-cao/[nhom]/sections/marketing.tsx").read_text(encoding="utf-8"):
            errors.append("marketing section: MKT-02 metric in column header")
    else:
        print(f"unknown job {job}")
        sys.exit(2)
    if errors:
        for e in errors[:80]:
            print("FAIL", e)
        print(f"checker: {len(errors)} error(s)")
        sys.exit(1)
    print(f"checker: OK {job}")


if __name__ == "__main__":
    main()
