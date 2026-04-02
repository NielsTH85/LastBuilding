import urllib.request, re

req = urllib.request.Request('https://maxroll.gg/last-epoch/planner', headers={
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
})
resp = urllib.request.urlopen(req, timeout=15)
html = resp.read().decode('utf-8', errors='replace')

# Find all script sources
scripts = re.findall(r'src="([^"]+)"', html)
for s in scripts:
    if 'planner' in s.lower() or 'data' in s.lower() or 'chunk' in s.lower() or 'leplanner' in s.lower():
        print(s)

# Look for any data inlining
for pat in ['data.json', 'gameData', 'plannerData', '__NEXT_DATA__', 'window.__']:
    if pat in html:
        idx = html.find(pat)
        print(f'\n{pat} found: {html[max(0,idx-50):idx+100]}')
