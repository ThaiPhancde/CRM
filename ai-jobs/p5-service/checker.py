"""Checker for ai-jobs/p5-service jobs. Stdlib only.   python -I checker.py <job-id> <repo-root>

UI jobs: files exist, no DB layer in views, Vietnamese copy, contract calls, idempotency key generated in useEffect,
client/server boundary (lessons from p4), no HTML injection. Content job: JSON shape, counts, spreads, languages.
Type safety is checked by `npx tsc --noEmit`; design quality is reviewed by Claude.
"""
import json
import re
import sys
from collections import Counter
from pathlib import Path

UI = {
    "tickets": {"files": ["src/app/(app)/cham-soc/page.tsx", "src/app/(app)/cham-soc/create-ticket.tsx"],
                "must": [r"listTickets\(", r"parseTicketFilter\(", r'pageUser\("ticket\.view"\)', r"bindTenant\(", r"createTicketAction", r"idempotencyKey", r"randomUUID", r"EmptyState", r"<caption", r"resolveOverdue"]},
    "ticket-detail": {"dir": "src/app/(app)/cham-soc/[id]", "files": ["src/app/(app)/cham-soc/[id]/page.tsx"],
                      "must": [r"getTicket\(", r"notFound\(", r"replyTicketAction", r"setTicketStatusAction", r"setTicketPriorityAction", r"assignTicketAction", r"canEdit", r"canAssign", r"idempotencyKey", r'dir="auto"', r"articles"]},
    "kb-list": {"files": ["src/app/(app)/tri-thuc/page.tsx"],
                "must": [r"listArticles\(", r"parseKbFilter\(", r'pageUser\("knowledge\.view"\)', r"EmptyState", r"<caption", r"hasDraft"]},
    "kb-editor": {"dir": "src/app/(app)/tri-thuc/[id]", "files": ["src/app/(app)/tri-thuc/[id]/page.tsx", "src/app/(app)/tri-thuc/moi/page.tsx"],
                  "must": [r"getArticle\(", r"saveArticleAction", r"setArticleStatusAction", r"notFound\(", r"canPublish", r'pageUser\("knowledge\.edit"\)', r'dir="auto"']},
}
FORBIDDEN = [r'from "@prisma/client"(?!.*import type)', r"\brootDb\b", r"\bworkspaceDb\b", r"\bdb\.", r'import \{[^}]*\bdb\b[^}]*\} from "@/lib/db"', r"dangerouslySetInnerHTML"]
VI = re.compile(r"[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]", re.I)
AR = re.compile(r"[؀-ۿ]")
DE = re.compile(r"[äöüß]|\b(und|ich|die|der|das|nicht|ist|Sie|Ihre|wir)\b", re.I)
CLIENT_OK = {"service/labels", "sales/labels"}


def lang_ok(lang, text):
    if lang == "ar":
        return bool(AR.search(text))
    if lang == "vi":
        return len(VI.findall(text)) >= 3
    if lang == "de":
        return bool(DE.search(text))
    return not AR.search(text)


def check_ui(job, root, errors):
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
        rel = p.relative_to(root)
        for pat in FORBIDDEN:
            for line in t.splitlines():
                if re.search(pat, line) and not line.lstrip().startswith("import type"):
                    errors.append(f"{rel}: forbidden {pat}")
                    break
        if len(VI.findall(t)) < 15:
            errors.append(f"{rel}: too little Vietnamese copy")
        if re.search(r"#[0-9a-fA-F]{6}\b", t):
            errors.append(f"{rel}: raw hex colour; use design tokens")
        if re.search(r"useState\(\s*\(\)\s*=>\s*crypto\.randomUUID", t):
            errors.append(f"{rel}: idempotency key generated during render (hydration mismatch) — generate in useEffect")
        if t.lstrip().startswith('"use client"'):
            for m in re.finditer(r'^import (?!type )\{([^}]*)\} from "@/modules/([^"]+)"', t, re.M):
                if m.group(2) not in CLIENT_OK and any(x.strip() and not x.strip().startswith("type ") for x in m.group(1).split(",")):
                    errors.append(f"{rel}: client file imports values from @/modules/{m.group(2)} (server code)")
        else:
            for m in re.finditer(r'^import \{([^}]*)\} from "(\.{1,2}/[^"]+)"', t, re.M):
                if any(x.strip().isupper() and len(x.strip()) > 2 for x in m.group(1).split(",")):
                    errors.append(f"{rel}: server page imports a constant from client module {m.group(2)}")
    for pat in spec["must"]:
        if not re.search(pat, text):
            errors.append(f"missing required usage {pat}")


def check_content(root, errors):
    try:
        kb = json.loads((root / "fixtures/knowledge.json").read_text(encoding="utf-8"))
        tk = json.loads((root / "fixtures/tickets.json").read_text(encoding="utf-8"))
    except Exception as e:  # noqa: BLE001
        errors.append(f"cannot read JSON: {e}")
        return
    if not isinstance(kb, list) or len(kb) != 20:
        errors.append("knowledge.json must be an array of 20")
    else:
        langs = Counter(a.get("language") for a in kb)
        for lg in ("vi", "en", "ar", "de"):
            if langs.get(lg, 0) < 4:
                errors.append(f"knowledge: need >= 4 in {lg}")
        ws = Counter(a.get("workspace") for a in kb)
        if ws.get("PIALPHA") != 14 or ws.get("TEAM-EU") != 6:
            errors.append(f"knowledge: workspace split {dict(ws)} (want 14/6)")
        if sum(1 for a in kb if a.get("publish")) != 16 or sum(1 for a in kb if a.get("revision")) != 4:
            errors.append("knowledge: need 16 publish:true and 4 with revision")
        for i, a in enumerate(kb):
            allowed = {"PIALPHA": ({"LUMI", "NOVA", None}, {"AE", "SA", "KW", "US", None}), "TEAM-EU": ({"ORBI", None}, {"DE", "FR", "US", None})}.get(a.get("workspace"))
            if not allowed or a.get("brand") not in allowed[0] or a.get("market") not in allowed[1]:
                errors.append(f"knowledge {i}: brand/market not allowed for workspace")
            body = str(a.get("body", ""))
            if not a.get("title") or not 8 <= len(body.splitlines()) <= 30:
                errors.append(f"knowledge {i}: title + 8–25 body lines required")
            if not lang_ok(a.get("language"), f"{a.get('title', '')} {body}"):
                errors.append(f"knowledge {i}: text does not look like {a.get('language')}")
            if "<" in body and re.search(r"<[a-z]+[ >]", body):
                errors.append(f"knowledge {i}: HTML tags in body; markdown only")
    if not isinstance(tk, list) or len(tk) != 30:
        errors.append("tickets.json must be an array of 30")
        return
    st = Counter(t.get("status") for t in tk)
    for s, n in {"MOI": 6, "DANG_XU_LY": 8, "CHO_KHACH": 5, "DA_GIAI_QUYET": 7, "DONG": 4}.items():
        if abs(st.get(s, 0) - n) > 1:
            errors.append(f"tickets: status {s} {st.get(s, 0)} (want ~{n})")
    if set(t.get("type") for t in tk) != {"GIAO_CHAM", "LOI_HANG", "DOI_TRA", "BAO_HANH", "KHAC"}:
        errors.append("tickets: must cover all five types")
    if sum(1 for t in tk if (t.get("hoursAgo") or 99) <= 6 and t.get("priority") in ("CAO", "KHAN")) < 6:
        errors.append("tickets: need ~8 recent CAO/KHAN tickets")
    keys = Counter(t.get("key") for t in tk)
    errors += [f"tickets: duplicate key {k}" for k, n in keys.items() if n > 1]
    for t in tk:
        k = t.get("key", "?")
        msgs = t.get("messages") or []
        if t.get("priority") not in ("THAP", "TRUNG", "CAO", "KHAN") or not isinstance(t.get("hoursAgo"), int):
            errors.append(f"{k}: bad priority/hoursAgo")
        if not msgs or msgs[0].get("kind") != "CUSTOMER":
            errors.append(f"{k}: first message must be CUSTOMER")
        if t.get("status") == "MOI" and len(msgs) != 1:
            errors.append(f"{k}: MOI tickets have only the customer message")
        if not (t.get("subject") and VI.search(t["subject"]) and len(t["subject"]) <= 80):
            errors.append(f"{k}: Vietnamese subject ≤ 80 chars required")
        for m in msgs:
            if m.get("kind") == "NOTE" and not VI.search(str(m.get("text", ""))):
                errors.append(f"{k}: NOTE must be Vietnamese")
        cust = " ".join(str(m.get("text", "")) for m in msgs if m.get("kind") in ("CUSTOMER", "REPLY"))
        if not lang_ok(t.get("language"), cust):
            errors.append(f"{k}: customer/reply text does not look like {t.get('language')}")


def main():
    job, root = sys.argv[1], Path(sys.argv[2] if len(sys.argv) > 2 else ".")
    errors = []
    if job == "content":
        check_content(root, errors)
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
