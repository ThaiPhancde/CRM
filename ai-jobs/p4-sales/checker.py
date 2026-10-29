"""Checker for ai-jobs/p4-sales jobs. Stdlib only.   python -I checker.py <job-id> <repo-root>

UI jobs: files exist, no database layer in views, Vietnamese copy, required contract calls, idempotency key on create forms.
Content job: JSON shape, counts, stage spread, phone country code, languages, required lost reasons.
Type safety is checked separately by `npx tsc --noEmit`; design quality is reviewed by Claude.
"""
import json
import re
import sys
from collections import Counter
from pathlib import Path

UI = {
    "leads": {"files": ["src/app/(app)/nhu-cau/page.tsx", "src/app/(app)/nhu-cau/board.tsx", "src/app/(app)/nhu-cau/create-lead.tsx"],
              "must": [r"listLeads\(", r"leadBoard\(", r"parseLeadFilter\(", r'pageUser\("lead\.view"\)', r"bindTenant\(", r"changeStageAction", r"createLeadAction",
                       r"idempotencyKey", r"randomUUID", r"onDrop|onDragOver", r"lostReason", r"EmptyState", r"<caption", r"STAGE_LABEL"]},
    "lead-detail": {"dir": "src/app/(app)/nhu-cau/[id]", "files": ["src/app/(app)/nhu-cau/[id]/page.tsx"],
                    "must": [r"getLead\(", r"notFound\(", r"logActivityAction", r"changeStageAction", r"reassignLeadAction", r"claimLeadAction", r"createTaskAction",
                             r"assignableUsers\(", r"canEdit", r"canAssign", r"canClaim", r"idempotencyKey", r'dir="auto"']},
    "queue": {"dir": "src/app/(app)/hang-doi", "files": ["src/app/(app)/hang-doi/page.tsx"],
              "must": [r"myQueue\(", r"listNotifications\(", r"markReadAction", r"bindTenant\(", r"EmptyState"]},
    "tasks": {"dir": "src/app/(app)/nhiem-vu", "files": ["src/app/(app)/nhiem-vu/page.tsx"],
              "must": [r"listTasks\(", r"parseTaskFilter\(", r'pageUser\("task\.manage"\)', r"createTaskAction", r"setTaskStatusAction", r"idempotencyKey", r"randomUUID", r"<caption", r"EmptyState"]},
}
FORBIDDEN = [r'from "@prisma/client"', r"\brootDb\b", r"\bworkspaceDb\b", r"\bdb\.", r'import \{[^}]*\bdb\b[^}]*\} from "@/lib/db"']
VI = re.compile(r"[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]", re.I)
AR = re.compile(r"[؀-ۿ]")
DE = re.compile(r"[äöüß]|\b(und|ich|die|der|das|nicht|ist|Sie)\b", re.I)
STAGES = ["MOI", "DANG_TU_VAN", "CHO_QUYET_DINH", "DA_MUA", "TU_CHOI", "MAT_LIEN_LAC"]
CC = {"AE": "971", "SA": "966", "KW": "965", "US": "1", "DE": "49", "FR": "33"}
CUR = {"AE": "AED", "SA": "SAR", "KW": "KWD", "US": "USD", "DE": "EUR", "FR": "EUR"}
WS = {"PIALPHA": ({"LUMI", "NOVA"}, {"AE", "SA", "KW", "US"}), "TEAM-EU": ({"ORBI"}, {"DE", "FR", "US"})}


def lang_ok(lang, text):
    if lang == "ar":
        return bool(AR.search(text))
    if lang == "vi":
        return len(VI.findall(text)) >= 2
    if lang == "de":
        return bool(DE.search(text))
    return not AR.search(text)


def check_content(root, errors):
    try:
        leads = json.loads((root / "fixtures/leads.json").read_text(encoding="utf-8"))
        scripts = json.loads((root / "fixtures/scripts.json").read_text(encoding="utf-8"))
    except Exception as e:  # noqa: BLE001
        errors.append(f"cannot read JSON: {e}")
        return
    if not isinstance(leads, list) or len(leads) != 60:
        errors.append(f"leads.json must be an array of 60 (got {len(leads) if isinstance(leads, list) else type(leads).__name__})")
        return
    keys = Counter(l.get("key") for l in leads)
    errors += [f"duplicate key {k}" for k, n in keys.items() if n > 1]
    stages = Counter(l.get("stage") for l in leads)
    want = {"MOI": 15, "DANG_TU_VAN": 15, "CHO_QUYET_DINH": 10, "DA_MUA": 8, "TU_CHOI": 7, "MAT_LIEN_LAC": 5}
    for s, n in want.items():
        if abs(stages.get(s, 0) - n) > 2:
            errors.append(f"stage {s}: {stages.get(s, 0)} (want ~{n})")
    if sum(1 for l in leads if l.get("language") == "vi") < 6:
        errors.append("need at least 6 Vietnamese leads")
    if sum(1 for l in leads if l.get("stage") == "MOI" and l.get("daysAgo") == 0) < 8:
        errors.append("need ~10 MOI leads with daysAgo 0")
    for l in leads:
        k = l.get("key", "?")
        ws = WS.get(l.get("workspace"))
        if not ws:
            errors.append(f"{k}: bad workspace")
            continue
        if l.get("brand") not in ws[0] or l.get("market") not in ws[1]:
            errors.append(f"{k}: brand/market not allowed for {l.get('workspace')}")
        m = l.get("market")
        if not re.fullmatch(r"\+\d{8,15}", str(l.get("phone", ""))) or not str(l.get("phone", "")).startswith("+" + CC.get(m, "?")):
            errors.append(f"{k}: phone must be E.164 with +{CC.get(m)}")
        if l.get("language") not in ("vi", "en", "ar", "de") or l.get("source") not in ("inbox", "website", "ads", "referral", "manual"):
            errors.append(f"{k}: bad language/source")
        if l.get("stage") not in STAGES:
            errors.append(f"{k}: bad stage")
        if l.get("stage") in ("TU_CHOI", "MAT_LIEN_LAC") and not (l.get("lostReason") and VI.search(l["lostReason"])):
            errors.append(f"{k}: lostReason required (Vietnamese)")
        b = l.get("budget")
        if b is not None and (b.get("currency") != CUR.get(m) or not re.fullmatch(r"\d+(\.\d{1,3})?", str(b.get("amount", "")))):
            errors.append(f"{k}: budget currency must be {CUR.get(m)} and amount a decimal string")
        if not isinstance(l.get("daysAgo"), int) or not 0 <= l["daysAgo"] <= 90:
            errors.append(f"{k}: daysAgo 0..90")
        msgs = l.get("messages") or []
        if not msgs or msgs[0].get("dir") != "IN":
            errors.append(f"{k}: first message must be IN")
        if l.get("stage") == "MOI" and any(x.get("dir") == "OUT" for x in msgs):
            errors.append(f"{k}: MOI leads have only IN messages")
        if l.get("stage") != "MOI" and len(msgs) < 2:
            errors.append(f"{k}: need 2-6 messages")
        for x in msgs:
            if x.get("channel") not in ("WHATSAPP", "MESSENGER", "PHONE", "EMAIL") or not isinstance(x.get("minutesAfter"), int):
                errors.append(f"{k}: bad message channel/minutesAfter")
                break
        text = " ".join(str(x.get("text", "")) for x in msgs)
        if not lang_ok(l.get("language"), text):
            errors.append(f"{k}: messages do not look like language {l.get('language')}")
    if not isinstance(scripts, list) or len(scripts) != 16:
        errors.append("scripts.json must be an array of 16")
        return
    langs = Counter(s.get("language") for s in scripts)
    for lg in ("vi", "en", "ar", "de"):
        if langs.get(lg, 0) < 3:
            errors.append(f"scripts: need >= 3 in {lg}")
    for i, s in enumerate(scripts):
        if s.get("stage") not in STAGES + [None] or s.get("brand") not in ("LUMI", "NOVA", "ORBI", None) or s.get("market") not in list(CC) + [None]:
            errors.append(f"script {i}: bad stage/brand/market")
        if not s.get("title") or len(str(s.get("body", "")).splitlines()) < 3:
            errors.append(f"script {i}: title and 3+ body lines required")
        if not lang_ok(s.get("language"), f"{s.get('title', '')} {s.get('body', '')}"):
            errors.append(f"script {i}: text does not look like {s.get('language')}")


def main():
    job, root = sys.argv[1], Path(sys.argv[2] if len(sys.argv) > 2 else ".")
    errors = []
    if job == "content":
        check_content(root, errors)
    elif job in UI:
        spec = UI[job]
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
            for pat in FORBIDDEN:
                if re.search(pat, t):
                    errors.append(f"{p.relative_to(root)}: forbidden {pat} (use the service contract)")
            if len(VI.findall(t)) < 15:
                errors.append(f"{p.relative_to(root)}: too little Vietnamese copy")
            if re.search(r"#[0-9a-fA-F]{6}\b", t):
                errors.append(f"{p.relative_to(root)}: raw hex color; use design tokens")
        # Bài học p4: client file kéo module server (DB) vào bundle → 500; trang server nhận hằng số từ file "use client" → undefined.
        for p in files:
            if not p.is_file():
                continue
            t = p.read_text(encoding="utf-8")
            if t.lstrip().startswith('"use client"'):
                for m in re.finditer(r'^import (?!type )\{([^}]*)\} from "@/modules/([^"]+)"', t, re.M):
                    if m.group(2) != "sales/labels" and any(x.strip() and not x.strip().startswith("type ") for x in m.group(1).split(",")):
                        errors.append(f"{p.relative_to(root)}: client file imports values from @/modules/{m.group(2)} (server code); use labels or `import type`")
            else:
                for m in re.finditer(r'^import \{([^}]*)\} from "(\./[^"]+)"', t, re.M):
                    if any(x.strip().isupper() and len(x.strip()) > 2 for x in m.group(1).split(",")):
                        errors.append(f"{p.relative_to(root)}: server page imports a constant from client module {m.group(2)}; move it to a shared module")
        for pat in spec["must"]:
            if not re.search(pat, text):
                errors.append(f"missing required usage {pat}")
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
