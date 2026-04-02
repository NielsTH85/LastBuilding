import urllib.request, re, json

# Try to find the sprite sheet used by maxroll for tree icons
# Their data comes from https://assets-ng.maxroll.gg/leplanner/game/data.json
# So the sprite sheet is probably at a similar path

base_urls = [
    # Common patterns for maxroll CDN
    "https://assets-ng.maxroll.gg/leplanner/game/treeIcons",
    "https://assets-ng.maxroll.gg/leplanner/game/tree-icons",
    "https://assets-ng.maxroll.gg/leplanner/game/tree_icons",
    "https://assets-ng.maxroll.gg/leplanner/game/passiveIcons",
    "https://assets-ng.maxroll.gg/leplanner/game/passive-icons",
    "https://assets-ng.maxroll.gg/leplanner/game/icons",
    "https://assets-ng.maxroll.gg/leplanner/game/treeAtlas",
    "https://assets-ng.maxroll.gg/leplanner/game/tree-atlas",
    "https://assets-ng.maxroll.gg/leplanner/game/atlas",
    "https://assets-ng.maxroll.gg/leplanner/img/treeIcons",
    "https://assets-ng.maxroll.gg/leplanner/img/tree-icons",
    "https://assets-ng.maxroll.gg/leplanner/img/icons",
    "https://assets-ng.maxroll.gg/leplanner/img/passiveIcons",
    "https://assets-ng.maxroll.gg/leplanner/img/atlas",
    "https://assets-ng.maxroll.gg/leplanner/icons/tree",
    "https://assets-ng.maxroll.gg/leplanner/icons/passive",
    "https://assets-ng.maxroll.gg/leplanner/tree/icons",
    "https://assets-ng.maxroll.gg/leplanner/passive/icons",
]

exts = [".webp", ".png", ".jpg"]

for base in base_urls:
    for ext in exts:
        url = base + ext
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'}, method='HEAD')
            resp = urllib.request.urlopen(req, timeout=5)
            size = resp.headers.get('Content-Length', '?')
            ct = resp.headers.get('Content-Type', '?')
            print(f"FOUND: {url} (size={size}, type={ct})")
        except urllib.error.HTTPError as e:
            pass  # Skip 404s silently
        except Exception as e:
            pass

# Also try fetching the actual planner page source to find JS bundle
print("\n--- Searching for JS bundles ---")
req = urllib.request.Request('https://maxroll.gg/last-epoch/planner', 
    headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'})
resp = urllib.request.urlopen(req, timeout=15)
html = resp.read().decode('utf-8', errors='replace')

# Find all script/link/img references
all_refs = re.findall(r'(?:src|href)="([^"]*(?:chunk|bundle|app|main|planner|leplanner)[^"]*)"', html, re.I)
for ref in all_refs[:20]:
    print(f"  ref: {ref}")

# Look for inline references to assets
asset_refs = re.findall(r'"(https?://[^"]*(?:maxroll|assets)[^"]*\.(?:js|css|webp|png))"', html, re.I)
for ref in asset_refs[:20]:
    print(f"  asset: {ref}")

# Look for _next or webpack patterns
next_refs = re.findall(r'"(/[^"]*(?:_next|static|chunks)[^"]*\.js)"', html)
for ref in next_refs[:10]:
    print(f"  next: {ref}")
