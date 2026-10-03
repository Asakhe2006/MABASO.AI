from pathlib import Path

path = Path("backend/main.py")
text = path.read_text(encoding="utf-8")
needle = "def send_refund_status_email(email: str, refund: dict[str, Any], status_message: str) -> None:\n"
positions = []
offset = 0
while True:
    found = text.find(needle, offset)
    if found < 0:
        break
    positions.append(found)
    offset = found + 1
if len(positions) != 2:
    raise SystemExit(f"expected 2 refund blocks, found {len(positions)}")
end = text.find('@app.post("/api/billing/trial/start")\n', positions[1])
if end < 0:
    raise SystemExit("trial endpoint anchor not found")
text = text[:positions[1]] + text[end:]
path.write_text(text, encoding="utf-8", newline="")
