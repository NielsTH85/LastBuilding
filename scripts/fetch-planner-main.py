import urllib.request, re, os

# The actual planner JS is at /leplanner/static/js/planner.js
url = "https://maxroll.gg/leplanner/static/js/planner.js"
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
resp = urllib.request.urlopen(req, timeout=30)
js = resp.read().decode('utf-8', errors='replace')
print(f"planner.js size: {len(js)} bytes")

# Save it for analysis
with open(r'c:\eob\scripts\planner.js', 'w', encoding='utf-8') as f:
    f.write(js)
print("Saved to planner.js")

# Search for icon/atlas/tree-related code
patterns = [
    'treeAtlas',
    'treeIcon',
    'passiveIcon',
    'iconAtlas',
    'spriteSheet',
    'background-position',
    'backgroundPosition',  
    r'\.icon\b',
    'nodeIcon',
    r'\.webp',
    r'\.png',
    'assets-ng',
    'tree.*sprite',
    'icon.*size',
    'icon.*width',
    'icon.*height',
    'SpriteSheet',
    'sprite_size',
    'ICON_SIZE',
    'SPRITE',
    'atlas',
]

for pattern in patterns:
    matches = re.findall(r'.{0,80}' + pattern + r'.{0,80}', js, re.I)
    if matches:
        unique = list(set(m.strip()[:180] for m in matches))[:5]
        print(f"\n  Pattern '{pattern}' ({len(matches)} matches):")
        for m in unique:
            print(f"    {m}")
