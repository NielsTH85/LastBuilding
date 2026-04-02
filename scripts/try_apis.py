"""
Try to fetch unique items from the maxroll API indirectly.
The build example contains uniqueID references. Let's extract those names
by looking at maxroll build pages.
"""
import urllib.request, re, json, ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

# The planner asset JS expects data from planners.maxroll.gg/data.json
# But the site may have moved to a different API endpoint.
# Let's check if the API has any accessible endpoints.

# Try the codex/items endpoint
urls_to_try = [
    'https://planners.maxroll.gg/api/data',
    'https://planners.maxroll.gg/api/uniques',
    'https://planners.maxroll.gg/le/data.json',
    'https://planners.maxroll.gg/le/data',
    'https://planners.maxroll.gg/game/data.json',
    'https://maxroll.gg/api/last-epoch/items',
    'https://maxroll.gg/last-epoch/api/data.json',
]

for url in urls_to_try:
    try:
        req = urllib.request.Request(url, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': '*/*',
        })
        resp = urllib.request.urlopen(req, timeout=10, context=ctx)
        raw = resp.read()
        ct = resp.headers.get('Content-Type', 'unknown')
        print(f'OK {url} -> {len(raw)} bytes ({ct})')
        if 'json' in ct:
            try:
                d = json.loads(raw)
                if isinstance(d, dict):
                    print(f'  Keys: {list(d.keys())[:10]}')
            except:
                pass
    except Exception as e:
        print(f'FAIL {url} -> {e}')
