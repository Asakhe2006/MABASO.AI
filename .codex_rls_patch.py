from pathlib import Path
path = Path("backend/main.py")
text = path.read_text(encoding="utf-8")
old = "                    'study_guide_visual_cache',\n                    'study_guide_visual_events'"
new = "                    'study_guide_visual_cache',\n                    'study_guide_visual_events',\n                    'refund_requests',\n                    'refund_audit_events'"
if text.count(old) != 1:
    raise SystemExit(text.count(old))
path.write_text(text.replace(old, new, 1), encoding="utf-8", newline="")
