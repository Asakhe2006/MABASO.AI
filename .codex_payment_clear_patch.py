from pathlib import Path
path = Path("frontend/src/App.jsx")
text = path.read_text(encoding="utf-8")
text = text.replace('    setPaymentRequests([]);\n    setManualPaymentDetails(null);', '    setPaymentRequests([]);\n    setPaymentHistory([]);\n    setManualPaymentDetails(null);')
path.write_text(text, encoding="utf-8", newline="")
