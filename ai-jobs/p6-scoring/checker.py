"""Checker for ai-jobs/p6-scoring jobs. Stdlib only.   python -I checker.py <job-id> <repo-root>

UI jobs: files exist, no DB layer in views, Vietnamese copy, contract calls, insufficient-data + version wording, client/server boundary.
Content: metric codes exactly as docs/metrics.md. Tests: imports, it.each tables, case count. vitest itself is run by Claude after merge
(the worktree has no .env / test database).
"""
import json
import re
import sys
from pathlib import Path

UI = {
    "customer-scores": {"files": ["src/app/(app)/khach-hang/[id]/score-card.tsx", "src/app/(app)/khach-hang/[id]/page.tsx", "src/app/(app)/khach-hang/page.tsx"],
                        "must": [r"getCustomerScores\(", r"Chưa đủ dữ liệu", r"REV-01", r"REV-03", r"REV-04", r"\.rfm", r"missingData", r"suggestedAction", r"version"]},
    "lead-scores": {"files": ["src/app/(app)/nhu-cau/page.tsx", "src/app/(app)/nhu-cau/board.tsx", "src/app/(app)/nhu-cau/[id]/page.tsx", "src/app/(app)/nhu-cau/[id]/lead-score.tsx"],
                    "must": [r"getLeadScore\(", r"\.score", r"Chưa", r"missingData", r"version"]},
    "score-admin": {"files": ["src/app/(app)/quan-tri/diem/page.tsx", "src/app/(app)/quan-tri/diem/version-form.tsx", "src/app/(app)/quan-tri/diem/recompute-button.tsx", "src/app/(app)/quan-tri/chi-so/page.tsx"],
                    "must": [r"listScoreVersions\(", r"createScoreVersionAction", r"recomputeAction", r'pageUser\("score\.config"\)', r"listMetricDefinitions\(", r'name=\{?[`"]w\.', r"100", r"<caption"]},
}
FORBIDDEN = [r"\brootDb\b", r"\bworkspaceDb\b", r"\bdb\.", r'import \{[^}]*\bdb\b[^}]*\} from "@/lib/db"', r"dangerouslySetInnerHTML"]
VI = re.compile(r"[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]", re.I)
CODES = [f"REV-0{i}" for i in range(1, 5)] + [f"OPS-0{i}" for i in range(1, 5)] + [f"CASH-0{i}" for i in range(1, 4)] + [f"CUS-0{i}" for i in range(1, 7)] + [f"MKT-0{i}" for i in range(1, 5)] + [f"AI-0{i}" for i in range(1, 4)]
INVENTED = re.compile(r"\b(HIGH|MEDIUM|LOW|VIP|GOLD|SILVER|AT_RISK|LOYAL|NEW_CUSTOMER)\b")


def check_ui(job, root, errors):
    spec = UI[job]
    text = ""
    for f in spec["files"]:
        p = root / f
        if not p.is_file():
            errors.append(f"missing {f}")
            continue
        t = p.read_text(encoding="utf-8")
        text += t
        for pat in FORBIDDEN:
            if re.search(pat, t):
                errors.append(f"{f}: forbidden {pat}")
        if len(VI.findall(t)) < 10:
            errors.append(f"{f}: too little Vietnamese copy")
        if re.search(r"#[0-9a-fA-F]{6}\b", t):
            errors.append(f"{f}: raw hex colour")
        if re.search(r"useState\(\s*\(\)\s*=>\s*crypto\.randomUUID", t):
            errors.append(f"{f}: idempotency key generated during render")
        if INVENTED.search(t):
            errors.append(f"{f}: invented band/segment name {INVENTED.search(t).group(0)} — use the exact enum values in the work order")
        if t.lstrip().startswith('"use client"'):
            for m in re.finditer(r'^import (?!type )\{([^}]*)\} from "@/modules/([^"]+)"', t, re.M):
                if not m.group(2).endswith("/labels") and any(x.strip() and not x.strip().startswith("type ") for x in m.group(1).split(",")):
                    errors.append(f"{f}: client file imports values from @/modules/{m.group(2)} (server code)")
        else:
            for m in re.finditer(r'^import \{([^}]*)\} from "(\.{1,2}/[^"]+)"', t, re.M):
                if any(x.strip().isupper() and len(x.strip()) > 2 for x in m.group(1).split(",")):
                    errors.append(f"{f}: server page imports a constant from client module {m.group(2)}")
    for pat in spec["must"]:
        if not re.search(pat, text):
            errors.append(f"missing required usage {pat}")


def main():
    job, root = sys.argv[1], Path(sys.argv[2] if len(sys.argv) > 2 else ".")
    errors = []
    if job == "metrics-content":
        try:
            rows = json.loads((root / "fixtures/metrics.json").read_text(encoding="utf-8"))
        except Exception as e:  # noqa: BLE001
            errors.append(f"cannot read JSON: {e}")
            rows = []
        codes = [r.get("code") for r in rows]
        if sorted(codes) != sorted(CODES):
            errors.append(f"codes differ from docs/metrics.md: missing {sorted(set(CODES) - set(codes))}, extra {sorted(set(codes) - set(CODES))}")
        for r in rows:
            for k in ("code", "group", "nameVi", "nameEn", "formula", "timeAnchor", "source", "owner"):
                if not r.get(k):
                    errors.append(f"{r.get('code')}: missing {k}")
            if r.get("code", "").split("-")[0] != r.get("group"):
                errors.append(f"{r.get('code')}: group must be the code prefix")
            if not VI.search(str(r.get("nameVi", "")) + str(r.get("formula", ""))):
                errors.append(f"{r.get('code')}: Vietnamese nameVi/formula required")
            if r.get("group") in ("REV", "CASH") and "VND" not in str(r.get("formula", "")):
                errors.append(f"{r.get('code')}: money metric formula must mention VND (D-44)")
    elif job == "formula-tests":
        p = root / "tests/formulas.test.ts"
        if not p.is_file():
            errors.append("missing tests/formulas.test.ts")
        else:
            t = p.read_text(encoding="utf-8")
            if '@/modules/scoring/formulas' not in t:
                errors.append("must import from @/modules/scoring/formulas")
            for fn in ("band3", "rfmSegment", "scoreRfm", "scoreTxnRisk", "scoreSupport", "scoreLead"):
                if fn not in t:
                    errors.append(f"no test for {fn}")
            if len(re.findall(r"\b(it|test)\.each", t)) < 5:
                errors.append("use it.each tables (>= 5)")
            rows = len(re.findall(r"^\s*\[", t, re.M))
            if rows < 45:
                errors.append(f"too few table rows ({rows} < 45)")
            if not re.search(r"[؀-ۿ]", t) or not re.search(r"(?i)preis|liefer|bestell", t):
                errors.append("scoreLead intent cases must include Arabic and German")
            if re.search(r"new Date\(\)", t):
                errors.append("use fixed dates, not new Date()")
    elif job in UI:
        check_ui(job, root, errors)
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
