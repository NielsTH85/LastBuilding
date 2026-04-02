"""
Fetch the current planner JS and find the data loading URL.
Maybe the site was updated and the URL changed.
"""
import urllib.request, re

# Get the planner page
req = urllib.request.Request('https://maxroll.gg/last-epoch/planner', headers={
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
})
resp = urllib.request.urlopen(req, timeout=15)
html = resp.read().decode('utf-8', errors='replace')

# Find ALL script tags
scripts = re.findall(r'<script[^>]*src="([^"]+)"', html)
print("All script tags:")
for s in scripts:
    print(f"  {s}")

# Also check for inline data
if '__REMIX_CONTEXT' in html or '__NEXT_DATA__' in html or 'window.__data' in html:
    print("\nFound inline data!")
    
# Check for any data URL patterns
print("\nLooking for data patterns in page...")
for pat in ['data.json', 'plannerData', 'gameData', 'uniques']:
    if pat in html:
        idx = html.find(pat)
        print(f"  {pat}: ...{html[max(0,idx-80):idx+80]}...")
