"""Checker for ai-jobs/p8-ai jobs. Stdlib only.   python -I checker.py <job-id> <repo-root>"""
import json
import re
import sys
from pathlib import Path

UI_FILES = ["src/app/(app)/ai/page.tsx", "src/app/(app)/ai/[id]/page.tsx", "src/app/(app)/ai/approval-buttons.tsx", "src/app/(app)/ai/budget-form.tsx"]
UI_MUST = [r"listRuns\(", r"getRun\(", r"listApprovals\(", r"aiStats\(", r"decideApprovalAction", r"setBudgetAction", r"AssistantBox", r"EvidenceList",
           r'pageUser\("ai\.run"\)', r'can\(user\.roles, "ai\.approve"\)', r'can\(user\.roles, "ai\.budget"\)', r"AI-01", r"AI-02", r"AI-03",
           r"FEATURE_LABEL", r"RUN_STATUS_LABEL", r"TOOL_LABEL", r"APPROVAL_STATUS_LABEL", r"notFound\(", r"<caption", r"USD"]
FORBIDDEN = [r"\brootDb\b", r"\bworkspaceDb\b", r"\bdb\.", r'import \{[^}]*\bdb\b[^}]*\} from "@/lib/db"', r"dangerouslySetInnerHTML"]
VI = re.compile(r"[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]", re.I)
AR = re.compile(r"[؀-ۿ]")
DE_HINT = re.compile(r"[äöüß]|\b(der|die|das|und|nicht|bestellung|kunde|termin|umsatz|heute|morgen|monat|woche|geliefert|zugestellt)\b", re.I)
STATUSES = ["UNFULFILLED", "IN_TRANSIT", "PARTIAL", "DELIVERED", "FAILED", "RETURNED"]
ORIGINAL_LEXICON = {
    "target": {"orders": ["đơn", "order"], "customers": ["khách", "customer"]},
    "fulfillment": {"FAILED": ["giao thất bại", "failed"], "DELIVERED": ["đã giao", "delivered"], "UNFULFILLED": ["chưa giao"]},
    "period": {"this_month": ["tháng này", "this month"], "last_month": ["tháng trước"], "today": ["hôm nay"]},
    "intents": {"task": ["tạo việc", "nhắc tôi"], "appointment": ["lịch hẹn", "appointment"], "report": ["doanh thu", "revenue"]},
    "markets": {"AE": ["uae", "dubai"], "DE": ["đức", "germany"]},
}


def check_ui(root, errors):
    text = ""
    for f in UI_FILES:
        p = root / f
        if not p.is_file():
            errors.append(f"missing {f}")
            continue
        t = p.read_text(encoding="utf-8")
        text += t
        for pat in FORBIDDEN:
            if re.search(pat, t):
                errors.append(f"{f}: forbidden {pat}")
        if len(VI.findall(t)) < 6:
            errors.append(f"{f}: too little Vietnamese copy")
        if re.search(r"#[0-9a-fA-F]{6}\b", t):
            errors.append(f"{f}: raw hex colour")
        if re.search(r'"(SUCCESS|FAILED|CANCELLED|DONE|COMPLETED)"', t):
            errors.append(f"{f}: invented status — use the labels in @/modules/ai/labels")
        if t.lstrip().startswith('"use client"'):
            for m in re.finditer(r'^import (?!type )\{([^}]*)\} from "@/modules/([^"]+)"', t, re.M):
                if not m.group(2).endswith("/labels") and any(x.strip() and not x.strip().startswith("type ") for x in m.group(1).split(",")):
                    errors.append(f"{f}: client file imports values from @/modules/{m.group(2)}")
        else:
            for m in re.finditer(r'^import \{([^}]*)\} from "(\.{1,2}/[^"]+)"', t, re.M):
                if any(x.strip().isupper() and len(x.strip()) > 2 for x in m.group(1).split(",")):
                    errors.append(f"{f}: server page imports a constant from client module {m.group(2)}")
    for pat in UI_MUST:
        if not re.search(pat, text):
            errors.append(f"missing required usage {pat}")


def lists(obj):
    if isinstance(obj, list):
        yield obj
    elif isinstance(obj, dict):
        for v in obj.values():
            yield from lists(v)


def check_lexicon(root, errors):
    try:
        lex = json.loads((root / "fixtures/ai/lexicon.json").read_text(encoding="utf-8"))
        tpl = json.loads((root / "fixtures/ai/reply-templates.json").read_text(encoding="utf-8"))
    except Exception as e:  # noqa: BLE001
        errors.append(f"cannot read JSON: {e}")
        return
    for k, sub in ORIGINAL_LEXICON.items():
        for kk, words in sub.items():
            have = lex.get(k, {}).get(kk, [])
            for w in words:
                if w not in have:
                    errors.append(f"lexicon {k}.{kk} lost existing phrase {w!r}")
    for key in ["target", "fulfillment", "cancelled", "repeat", "period", "intents", "metrics", "groupByMarket", "tomorrow", "todayWords", "customerMarkers", "markets"]:
        if key not in lex:
            errors.append(f"lexicon missing key {key}")
            continue
        for lst in lists(lex[key]):
            if len(set(lst)) != len(lst):
                errors.append(f"lexicon {key}: duplicate phrases")
            if not any(AR.search(w) for w in lst):
                errors.append(f"lexicon {key}: a list has no Arabic phrase ({lst[:2]})")
            if not any(DE_HINT.search(w) or (w.isascii() and w not in json.dumps(ORIGINAL_LEXICON)) for w in lst):
                errors.append(f"lexicon {key}: a list seems to have no German phrase ({lst[:2]})")
    for lang in ["vi", "en", "ar", "de"]:
        t = tpl.get(lang)
        if not t:
            errors.append(f"reply-templates missing {lang}")
            continue
        if "{{name}}" not in t.get("greeting", ""):
            errors.append(f"{lang}.greeting needs {{{{name}}}}")
        if "{{excerpt}}" not in t.get("kb", ""):
            errors.append(f"{lang}.kb needs {{{{excerpt}}}}")
        if "{{brand}}" not in t.get("closing", ""):
            errors.append(f"{lang}.closing needs {{{{brand}}}}")
        if not t.get("noOrder") or "{{" in t.get("noOrder", ""):
            errors.append(f"{lang}.noOrder required, no placeholder")
        if sorted(t.get("status", {}).keys()) != sorted(STATUSES):
            errors.append(f"{lang}.status must have exactly {STATUSES}")
        for s, v in t.get("status", {}).items():
            if "{{order}}" not in v:
                errors.append(f"{lang}.status.{s} needs {{{{order}}}}")
        if lang == "ar" and not AR.search(json.dumps(t, ensure_ascii=False)):
            errors.append("ar templates must be in Arabic script")
        if re.search(r"\d+\s?%|\$|€|AED|USD|refund|rückerstattung|hoàn tiền", json.dumps(t, ensure_ascii=False), re.I):
            errors.append(f"{lang}: no prices, discounts or refund promises")


def check_tests(root, errors):
    p = root / "tests/ai-rules.test.ts"
    if not p.is_file():
        errors.append("missing tests/ai-rules.test.ts")
        return
    t = p.read_text(encoding="utf-8")
    for imp in ("@/adapters/llm/replay", "@/modules/ai/redact", "@/adapters/llm/pricing"):
        if imp not in t:
            errors.append(f"must import from {imp}")
    for fn in ("parseSearch", "parseAssistant", "redactText", "redactDeep", "costUsd"):
        if fn not in t:
            errors.append(f"no test uses {fn}")
    for k in ("today", "yesterday", "last_7_days", "this_month", "last_month", "last_30_days", "tao_lich_hen", "tao_nhiem_vu", "hoi_bao_cao", "tim_don", "tim_khach", "[đã ẩn]", "2026-01-15"):
        if k not in t:
            errors.append(f"missing case for {k}")
    if len(re.findall(r"\b(it|test)\.each", t)) < 4:
        errors.append("use it.each tables (>= 4)")
    rows = len(re.findall(r"^\s*\[", t, re.M))
    if rows < 45:
        errors.append(f"too few table rows ({rows} < 45)")
    if re.search(r"new Date\(\)", t):
        errors.append("use fixed dates, not new Date()")


def main():
    job, root = sys.argv[1], Path(sys.argv[2] if len(sys.argv) > 2 else ".")
    errors = []
    {"ai-admin-ui": check_ui, "ai-lexicon": check_lexicon, "ai-tests": check_tests}.get(job, lambda *_: (print(f"unknown job {job}"), sys.exit(2)))(root, errors)
    if errors:
        for e in errors[:60]:
            print("FAIL", e)
        print(f"checker: {len(errors)} error(s)")
        sys.exit(1)
    print(f"checker: OK {job}")


if __name__ == "__main__":
    main()
