import urllib.request, re

req = urllib.request.Request('https://maxroll.gg/last-epoch/planner', 
    headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'})
resp = urllib.request.urlopen(req, timeout=10)
html = resp.read().decode('utf-8', errors='replace')

# Find script tags
scripts = re.findall(r'<script[^>]*src="([^"]+)"', html)
for s in scripts:
    print(f'Script: {s}')
