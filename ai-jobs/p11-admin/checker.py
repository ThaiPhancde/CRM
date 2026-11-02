"""Checker for ai-jobs/p11-admin jobs. Stdlib only.   python -I checker.py <job-id> <repo-root>"""
import re
import sys
from pathlib import Path

PAGES = ["src/app/(app)/quan-tri/nhat-ky/page.tsx", "src/app/(app)/quan-tri/cau-hinh/page.tsx", "src/app/(app)/quan-tri/cau-hinh/forms.tsx"]
MUST = [r"listAuditLog\(", r"auditFilter\.parse", r"changed", r"getConfig\(", r"saveSlaAction", r"saveRoutingAction", r"saveCapAction", r"saveHoursAction",
        r"saveLowStockAction", r"export function SlaForm", r"export function RoutingForm", r"export function CapForm", r"export function HoursForm",
        r"export function LowStockForm", r"PRIORITY_LABEL", r'type="date"', r"/quan-tri/danh-muc", r"/quan-tri/diem", r'scope="col"', r"sr-only", r"htmlFor",
        r"useActionState", r'"use client"', r'tone="warning"', r'pageUser\("admin\.audit"\)', r'pageUser\("admin\.settings"\)']
FORBIDDEN = [r"\brootDb\b", r"\bworkspaceDb\b", r"\bdb\.", r"from \"@prisma/client\"", r"#[0-9a-fA-F]{6}\b", r"dangerouslySetInnerHTML", r"text-(red|green|yellow|orange)-\d"]
VI = re.compile(r"[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]", re.I)


def main():
    job, root = sys.argv[1], Path(sys.argv[2] if len(sys.argv) > 2 else ".")
    errors = []
    if job == "admin-pages":
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
            if len(VI.findall(t)) < 15:
                errors.append(f"{f}: too little Vietnamese copy")
        for pat in MUST:
            if not re.search(pat, text):
                errors.append(f"missing required usage {pat}")
    elif job == "admin-tests":
        p = root / "tests/admin-pure.test.ts"
        if not p.is_file():
            errors.append("missing tests/admin-pure.test.ts")
        else:
            t = p.read_text(encoding="utf-8")
            for mod in ("@/modules/admin/config", "@/modules/admin/audit"):
                if mod not in t:
                    errors.append(f"must import from {mod}")
            for fn in ("slaSchema", "routingNumbers", "capSchema", "hoursSchema", "lowStockSchema", "auditFilter", "changedKeys"):
                if fn not in t:
                    errors.append(f"no test for {fn}")
            if re.search(r"\b(db|rootDb|workspaceDb|makeWorkspace)\b", t):
                errors.append("pure tests only — no database")
            if len(re.findall(r"\b(it|test)\.each", t)) < 6:
                errors.append("use it.each tables (>= 6)")
            if len(re.findall(r"^\s*\[", t, re.M)) < 45:
                errors.append("too few table rows (< 45)")
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
