import json
import re
import urllib.request
import os
from datetime import datetime, timezone

SOURCE = "https://www.goodreturns.in/gold-rates/chennai.html"
OUTPUT = "assets/gold-market-rates.json"

request = urllib.request.Request(SOURCE, headers={"User-Agent": "Mozilla/5.0"})
html = urllib.request.urlopen(request, timeout=30).read().decode("utf-8", "replace")
rates = {}
for purity in ("18K", "22K", "24K"):
    pattern = rf'id=["\']{purity}-price["\'][^>]*>[\s\S]{{0,120}}?(?:₹|&#x20b9;|&#8377;|&rupee;)\s*([\d,]+(?:\.\d+)?)'
    match = re.search(pattern, html, re.IGNORECASE)
    if not match:
        raise RuntimeError(f"Could not parse {purity} rate")
    value = float(match.group(1).replace(",", ""))
    if not 1000 <= value <= 100000:
        raise RuntimeError(f"Invalid {purity} rate: {value}")
    rates[purity] = value

previous = {}
if os.path.exists(OUTPUT):
    try:
        with open(OUTPUT, encoding="utf-8") as file:
            previous = json.load(file)
    except (OSError, ValueError):
        previous = {}

if previous.get("rates") == rates:
    print("Rates unchanged; leaving the stored file untouched.")
    raise SystemExit(0)

with open(OUTPUT, "w", encoding="utf-8") as file:
    json.dump({"location": "Chennai", "source": SOURCE, "rates": rates, "updatedAt": datetime.now(timezone.utc).isoformat()}, file, indent=2)
    file.write("\n")
