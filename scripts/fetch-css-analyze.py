import urllib.request, re

# 1. Fetch the CSS file
css_url = "https://assets-ng.maxroll.gg/leplanner/static/css/planner.css"
req = urllib.request.Request(css_url, headers={'User-Agent': 'Mozilla/5.0'})
resp = urllib.request.urlopen(req, timeout=15)
css = resp.read().decode('utf-8', errors='replace')
print(f"planner.css: {len(css)} bytes")
with open(r'c:\eob\scripts\planner.css', 'w', encoding='utf-8') as f:
    f.write(css)

# Search for sprite-icon class and any image URLs
for pat in ['lep-sprite-icon', 'sprite-icon', 'treeAtlas', 'background-image', r'\.webp', r'\.png']:
    matches = re.findall(r'.{0,80}' + pat + r'.{0,80}', css, re.I)
    if matches:
        print(f"\n'{pat}' ({len(matches)} matches):")
        for m in list(set(m.strip()[:200] for m in matches))[:5]:
            print(f"  {m}")

# 2. Search the JS file more thoroughly for the sprite sheet path
print("\n\n=== Searching planner.js for sprite sheet details ===")
with open(r'c:\eob\scripts\planner_asset.js', 'r', encoding='utf-8') as f:
    js = f.read()

# Find the lep-sprite-icon definition and context
for pat in ['lep-sprite-icon', 'sprite.icon', 'treeIcons', 'tree.icon', 'tree_icon']:
    matches = re.findall(r'.{0,120}' + pat + r'.{0,120}', js, re.I)
    if matches:
        print(f"\n'{pat}' ({len(matches)} matches):")
        for m in list(set(m.strip()[:250] for m in matches))[:3]:
            print(f"  {m}")

# Find what i.h() resolves to - the asset URL builder
# Look for asset path patterns
for pat in [r'assets-ng\.maxroll', r'leplanner/game', r'leplanner/img', r'leplanner/icon', r'icons/.*\.webp']:
    matches = re.findall(r'.{0,80}' + pat + r'.{0,80}', js, re.I)
    if matches:
        print(f"\n'{pat}' ({len(matches)} matches):")
        for m in list(set(m.strip()[:200] for m in matches))[:3]:
            print(f"  {m}")

# Find URL builder function
for pat in [r'function\s+\w+\([^)]*\)\s*\{\s*return\s*["\'`]https?://']:
    matches = re.findall(r'.{0,30}' + pat + r'.{0,150}', js, re.I)
    if matches:
        print(f"\nURL builder pattern:")
        for m in matches[:3]:
            print(f"  {m.strip()[:200]}")

# Look for CDN/static path config
for pat in [r'staticPath|basePath|cdnUrl|assetUrl|baseUrl|publicPath']:
    matches = re.findall(r'.{0,80}' + pat + r'.{0,80}', js, re.I)
    if matches:
        print(f"\n'{pat}' ({len(matches)} matches):")
        for m in list(set(m.strip()[:200] for m in matches))[:5]:
            print(f"  {m}")
