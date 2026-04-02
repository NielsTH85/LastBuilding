"""Try to fetch maxroll's data.json with different approaches."""
import urllib.request, json, ssl

# Disable SSL verification just in case
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

# The JS shows planners.maxroll.gg is used in production
# Let's try with full browser-like headers  
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://maxroll.gg/last-epoch/planner',
    'Origin': 'https://maxroll.gg',
    'Sec-Fetch-Site': 'cross-site',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Dest': 'empty',
}

urls = [
    'https://planners.maxroll.gg/data.json',
    'https://planners.maxroll.gg/last-epoch/data.json',
]

for url in urls:
    try:
        req = urllib.request.Request(url, headers=headers)
        resp = urllib.request.urlopen(req, timeout=15, context=ctx)
        raw = resp.read()
        print(f'OK {url} -> {len(raw)} bytes')
        # Try to decode
        try:
            data = json.loads(raw)
            print(f'  JSON keys: {list(data.keys())[:10]}')
            if 'uniques' in data:
                print(f'  Uniques: {len(data["uniques"])}')
        except:
            print(f'  First 200: {raw[:200]}')
    except urllib.error.HTTPError as e:
        # Read the error body
        body = e.read()[:200] if e.fp else b''
        print(f'FAIL {url} -> {e.code} {e.reason}')
        print(f'  Headers: {dict(e.headers)}')
    except Exception as e:
        print(f'FAIL {url} -> {e}')
