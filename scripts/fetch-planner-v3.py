import urllib.request, re, json

# Try various URLs for the planner assets
urls_to_try = [
    "https://maxroll.gg/leplanner/static/js/planner.js",
    "https://leplanner.maxroll.gg/static/js/planner.js",
    "https://maxroll.gg/last-epoch/planner/static/js/planner.js",
    "https://assets-ng.maxroll.gg/leplanner/static/js/planner.js",
    # CSS for sprite sheets
    "https://maxroll.gg/leplanner/static/css/planner.css",
    "https://leplanner.maxroll.gg/static/css/planner.css",
    "https://maxroll.gg/last-epoch/planner/static/css/planner.css",
    "https://assets-ng.maxroll.gg/leplanner/static/css/planner.css",
]

for url in urls_to_try:
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        resp = urllib.request.urlopen(req, timeout=10)
        data = resp.read()
        print(f"  OK {url} -> {len(data)} bytes")
        ext = url.rsplit('.', 1)[-1]
        fname = f"c:\\eob\\scripts\\planner_asset.{ext}"
        with open(fname, 'wb') as f:
            f.write(data)
        print(f"  Saved to {fname}")
        # Quick search
        text = data.decode('utf-8', errors='replace')
        for pat in ['treeAtlas', 'atlas', 'sprite', '.webp', '.png', 'icon']:
            matches = re.findall(r'.{0,60}' + pat + r'.{0,60}', text, re.I)[:3]
            if matches:
                print(f"    '{pat}': {len(matches)} hits")
                for m in matches[:2]:
                    print(f"      {m.strip()[:150]}")
        break
    except Exception as e:
        print(f"  FAIL {url} -> {e}")

print("\n--- Now checking the actual planner page for all resource URLs ---")
# Fetch the planner page itself
url = "https://maxroll.gg/last-epoch/planner"
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
resp = urllib.request.urlopen(req, timeout=15)
html = resp.read().decode('utf-8', errors='replace')

# Find ALL script src and link href
scripts = re.findall(r'<script[^>]+src="([^"]+)"', html)
links = re.findall(r'<link[^>]+href="([^"]+)"', html)
print(f"\nScripts ({len(scripts)}):")
for s in scripts:
    print(f"  {s}")
print(f"\nLinks ({len(links)}):")
for l in links:
    print(f"  {l}")

# Find any image/asset references 
assets = re.findall(r'https?://[^\s"\'<>]+(?:\.png|\.webp|\.jpg|\.svg|\.gif)', html, re.I)
print(f"\nImage refs ({len(assets)}):")
for a in set(assets):
    print(f"  {a}")

# Find any inline JS that references planner
inline_js = re.findall(r'<script[^>]*>(.*?)</script>', html, re.S)
for idx, chunk in enumerate(inline_js):
    if 'planner' in chunk.lower() or 'atlas' in chunk.lower() or 'tree' in chunk.lower():
        print(f"\nInline script #{idx} ({len(chunk)} chars) mentions planner/atlas/tree:")
        print(chunk[:500])

# Also check __NEXT_DATA__ for any config
next_data = re.findall(r'__NEXT_DATA__\s*=\s*({.*?})\s*</script>', html, re.S)
if next_data:
    try:
        nd = json.loads(next_data[0])
        print(f"\n__NEXT_DATA__ keys: {list(nd.keys())}")
        if 'props' in nd:
            print(f"  props keys: {list(nd['props'].keys())}")
            if 'pageProps' in nd['props']:
                pp = nd['props']['pageProps']
                print(f"  pageProps keys: {list(pp.keys())}")
    except:
        print(f"__NEXT_DATA__: {next_data[0][:200]}")
