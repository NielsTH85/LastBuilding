import urllib.request, re

# Fetch the LE planner JS bundle
urls_to_check = [
    "https://maxroll.gg/assets/last-epoch.planner-D5LkDMoJ.js",
    "https://maxroll.gg/assets/planner-page-sE1WUoQC.js",
    "https://maxroll.gg/leplanner/static/js/embed.js",
]

for url in urls_to_check:
    print(f"\n=== {url} ===")
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
        resp = urllib.request.urlopen(req, timeout=15)
        js = resp.read().decode('utf-8', errors='replace')
        print(f"  Size: {len(js)} bytes")
        
        # Search for treeAtlas, icon, sprite sheet references
        for pattern in ['treeAtlas', 'TreeAtlas', 'tree_atlas', 'treeIcon', 'TreeIcon',
                       'passiveIcon', 'PassiveIcon', 'iconAtlas', 'spriteSheet',
                       'background-position', 'bgPos', 'sprite.*atlas',
                       'assets-ng.maxroll.gg.*icon', 'assets-ng.maxroll.gg.*tree',
                       'assets-ng.maxroll.gg.*atlas', 'assets-ng.maxroll.gg.*sprite',
                       '/leplanner/.*\\.webp', '/leplanner/.*\\.png',
                       'tree.*icon.*url', 'icon.*sprite', '.webp']:
            matches = re.findall(r'.{0,60}' + pattern + r'.{0,60}', js, re.I)
            if matches:
                print(f"  Pattern '{pattern}':")
                for m in matches[:3]:
                    # clean up for readability
                    clean = m.replace('\n', ' ').strip()
                    print(f"    {clean[:150]}")
    except urllib.error.HTTPError as e:
        print(f"  HTTP {e.code}")
    except Exception as e:
        print(f"  Error: {e}")
