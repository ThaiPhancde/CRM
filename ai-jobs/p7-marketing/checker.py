"""Checker for ai-jobs/p7-marketing jobs. Stdlib only.   python -I checker.py <job-id> <repo-root>

UI: files exist, no DB layer in views, Vietnamese copy, contract calls, metric codes, client/server boundary, exact enums.
Content: 4 keys x 4 languages, variables, opt-out line, no URL/phone/price. Tests: imports, it.each tables, row count.
vitest itself is run by Claude after merge (the worktree has no .env / test database).
"""
import json
import re
import sys
from pathlib import Path

UI = {
    "campaigns-ui": {
        "files": ["src/app/(app)/chien-dich/page.tsx", "src/app/(app)/chien-dich/campaign-form.tsx", "src/app/(app)/chien-dich/[id]/page.tsx",
                  "src/app/(app)/chien-dich/[id]/touchpoint-form.tsx", "src/app/(app)/chien-dich/[id]/status-buttons.tsx"],
        "must": [r"listCampaigns\(", r"campaignOptions\(", r"getCampaign\(", r"saveCampaignAction", r"setCampaignStatusAction", r"addTouchpointAction",
                 r'pageUser\("campaign\.manage"\)', r"MKT-01", r"MKT-02", r"CAMPAIGN_STATUS_LABEL", r"CAMPAIGN_CHANNELS", r"RUN_STATUS_LABEL",
                 r"notFound\(", r"idempotencyKey", r"customerPhone", r"base\(", r"<caption", r'type="date"', r'type="datetime-local"'],
    },
}
FORBIDDEN = [r"\brootDb\b", r"\bworkspaceDb\b", r"\bdb\.", r'import \{[^}]*\bdb\b[^}]*\} from "@/lib/db"', r"dangerouslySetInnerHTML"]
VI = re.compile(r"[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]", re.I)
INVENTED = re.compile(r'"(ACTIVE|PAUSED|COMPLETED|CANCELLED|SCHEDULED|ARCHIVED)"')  # campaign status is only DRAFT/RUNNING/ENDED
KEYS = ["repurchase_reminder", "repurchase_offer", "back_in_stock", "winback"]
OPTOUT = {"vi": "Trả lời STOP để ngừng nhận tin.", "en": "Reply STOP to unsubscribe.", "ar": "أرسل STOP لإيقاف الرسائل.",
          "de": "Antworten Sie mit STOP, um keine Nachrichten mehr zu erhalten."}


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
        if len(VI.findall(t)) < 8:
            errors.append(f"{f}: too little Vietnamese copy")
        if re.search(r"#[0-9a-fA-F]{6}\b", t):
            errors.append(f"{f}: raw hex colour")
        if re.search(r"useState\(\s*\(\)\s*=>\s*crypto\.randomUUID", t):
            errors.append(f"{f}: idempotency key generated during render")
        m = INVENTED.search(t)
        if m and "JOURNEY_STATUS" not in t:
            errors.append(f"{f}: invented status {m.group(0)} — campaign status is DRAFT/RUNNING/ENDED")
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


def check_templates(root, errors):
    try:
        rows = json.loads((root / "fixtures/message-templates.json").read_text(encoding="utf-8"))
    except Exception as e:  # noqa: BLE001
        errors.append(f"cannot read JSON: {e}")
        return
    got = sorted((r.get("key"), r.get("language")) for r in rows)
    want = sorted((k, l) for k in KEYS for l in OPTOUT)
    if got != want:
        errors.append(f"key x language set differs: missing {sorted(set(want) - set(got))}, extra {sorted(set(got) - set(want))}")
    for r in rows:
        tag = f"{r.get('key')}/{r.get('language')}"
        body, subj = str(r.get("body", "")), str(r.get("subject", ""))
        if not subj or len(subj) > 70:
            errors.append(f"{tag}: subject missing or > 70 chars")
        if len(body) > 320:
            errors.append(f"{tag}: body > 320 chars ({len(body)})")
        for v in ("{{name}}", "{{brand}}"):
            if v not in body:
                errors.append(f"{tag}: body must contain {v}")
        extra = set(re.findall(r"\{\{(\w+)\}\}", body + subj)) - {"name", "brand"}
        if extra:
            errors.append(f"{tag}: unknown variables {extra}")
        if not body.rstrip().endswith(OPTOUT.get(r.get("language"), "\0")):
            errors.append(f"{tag}: body must end with the exact opt-out line")
        if re.search(r"https?://|www\.|\+?\d[\d\s-]{7,}|\d+\s?%|\d+[.,]?\d*\s?(VND|AED|EUR|USD|đ)\b", body):
            errors.append(f"{tag}: no URLs, phone numbers, prices or discount figures")
        lang = r.get("language")
        if lang == "ar" and not re.search(r"[؀-ۿ]", body):
            errors.append(f"{tag}: Arabic body must be in Arabic script")
        if lang == "vi" and not VI.search(body):
            errors.append(f"{tag}: Vietnamese body needs diacritics")


def check_tests(root, errors):
    p = root / "tests/marketing-rules.test.ts"
    if not p.is_file():
        errors.append("missing tests/marketing-rules.test.ts")
        return
    t = p.read_text(encoding="utf-8")
    for imp in ("@/modules/marketing/segments", "@/modules/marketing/journeys"):
        if imp not in t:
            errors.append(f"must import from {imp}")
    for fn in ("compileRules", "segmentWhere", "nextSendable", "QUIET", "OPT_IN_MARKETS", "ValidationError"):
        if fn not in t:
            errors.append(f"no test uses {fn}")
    for f in ("market", "brand", "tag", "language", "orderCount", "lastOrderDays", "recencyDays", "daysToNextPurchase", "deliveredOrders",
              "rev03", "repurchase60", "openTickets", "rfm", "txnRisk", "supportNeed"):
        if f'"{f}"' not in t:
            errors.append(f"no row for field {f}")
    for tz in ("Asia/Ho_Chi_Minh", "Asia/Dubai", "Europe/Berlin", "America/New_York", "Asia/Kolkata"):
        if tz not in t:
            errors.append(f"no nextSendable row for {tz}")
    if len(re.findall(r"\b(it|test)\.each", t)) < 3:
        errors.append("use it.each tables (>= 3)")
    rows = len(re.findall(r"^\s*\[", t, re.M))
    if rows < 45:
        errors.append(f"too few table rows ({rows} < 45)")
    if "403" not in t:
        errors.append("rev03 without money must assert status 403")
    if re.search(r"new Date\(\)", t):
        errors.append("use fixed dates, not new Date()")


def main():
    job, root = sys.argv[1], Path(sys.argv[2] if len(sys.argv) > 2 else ".")
    errors = []
    if job == "message-templates":
        check_templates(root, errors)
    elif job == "marketing-tests":
        check_tests(root, errors)
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
