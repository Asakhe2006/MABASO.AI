from pathlib import Path
path = Path("frontend/src/App.jsx")
text = path.read_text(encoding="utf-8")
old = '''    if (!authToken) {
      setBillingUsage(null);
      setBillingSubscription(null);
      setPaymentRequests([]);
      setManualPaymentDetails(null);'''
new = '''    if (!authToken) {
      setBillingUsage(null);
      setBillingSubscription(null);
      setPaymentRequests([]);
      setPaymentHistory([]);
      setManualPaymentDetails(null);'''
print("before", text.count(old), "after", text.count(new))
if text.count(old) != 2:
    raise SystemExit(text.count(old))
updated = text.replace(old, new)
print("updated_after", updated.count(new))
path.write_text(updated, encoding="utf-8", newline="")
