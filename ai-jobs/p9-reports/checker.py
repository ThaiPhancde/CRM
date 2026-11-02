"""Checker for ai-jobs/p9-reports jobs. Stdlib only.   python -I checker.py <job-id> <repo-root>"""
import re
import sys
from pathlib import Path

FILES = ["src/app/(app)/bao-cao/[nhom]/sections/van-don.tsx", "src/app/(app)/bao-cao/[nhom]/sections/ai.tsx"]
MUST = [r"export async function FulfillmentSection", r"export async function AiSection", r"fulfillmentReport\(", r"aiReport\(", r"ReportChart", r"ReportTable",
        r"OPS-01", r"OPS-02", r"OPS-03", r"OPS-04", r"AI-01", r"AI-03", r"FEATURE_LABEL", r"ctx\.definitions", r"Đang xử lý"]
FORBIDDEN = [r"\brootDb\b", r"\bworkspaceDb\b", r"\bdb\.", r'from "@/lib/db"', r"@prisma/client\"", r"#[0-9a-fA-F]{6}\b", r"Đang dựng", r"dangerouslySetInnerHTML"]
VI = re.compile(r"[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]", re.I)


def main():
    job, root = sys.argv[1], Path(sys.argv[2] if len(sys.argv) > 2 else ".")
    errors = []
    if job == "report-sections":
        text = ""
        for f in FILES:
            p = root / f
            if not p.is_file():
                errors.append(f"missing {f}")
                continue
            t = p.read_text(encoding="utf-8")
            text += t
            for pat in FORBIDDEN:
                if re.search(pat, t):
                    errors.append(f"{f}: forbidden {pat}")
            if len(VI.findall(t)) < 8:
                errors.append(f"{f}: too little Vietnamese copy")
            if t.count("<ReportChart") > t.count("<ReportTable"):
                errors.append(f"{f}: every chart needs a table with the same rows")
        for pat in MUST:
            if not re.search(pat, text):
                errors.append(f"missing required usage {pat}")
    elif job == "report-tests":
        p = root / "tests/reports-period.test.ts"
        if not p.is_file():
            errors.append("missing tests/reports-period.test.ts")
        else:
            t = p.read_text(encoding="utf-8")
            if "@/modules/reports/period" not in t:
                errors.append("must import from @/modules/reports/period")
            for fn in ("parseReportFilter", "rangeParams", "addDays", "todayVN", "toReportCurrency", "pivotCohort", "pct"):
                if fn not in t:
                    errors.append(f"no test for {fn}")
            for k in ("2028-02-29", "-1", "VND"):
                if k not in t:
                    errors.append(f"missing case containing {k}")
            if len(re.findall(r"\b(it|test)\.each", t)) < 5:
                errors.append("use it.each tables (>= 5)")
            if len(re.findall(r"^\s*\[", t, re.M)) < 40:
                errors.append("too few table rows (< 40)")
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
