import json, urllib.request, os

with open(r'c:\eob\maxroll-game-data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

ta = data.get('treeAtlas', [])
out = r'C:\eob\apps\planner-web\public\icons\tree'
os.makedirs(out, exist_ok=True)

# Try various URL patterns with the first treeAtlas value (15951) and index (0)
test_icon = ta[0]  # 15951
patterns = [
    f'https://assets-ng.maxroll.gg/leplanner/game/tree/{test_icon}.webp',
    f'https://assets-ng.maxroll.gg/leplanner/game/tree/{test_icon}.png',
    f'https://assets-ng.maxroll.gg/leplanner/game/icons/{test_icon}.webp',
    f'https://assets-ng.maxroll.gg/leplanner/game/icons/{test_icon}.png',
    f'https://assets-ng.maxroll.gg/leplanner/icons/tree/{test_icon}.webp',
    f'https://assets-ng.maxroll.gg/leplanner/icons/{test_icon}.webp',
    f'https://assets-ng.maxroll.gg/leplanner/game/treeAtlas/{test_icon}.webp',
    f'https://assets-ng.maxroll.gg/leplanner/game/tree/0.webp',
    f'https://assets-ng.maxroll.gg/leplanner/game/tree/0.png',
]

for url in patterns:
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        resp = urllib.request.urlopen(req, timeout=5)
        print(f'OK ({resp.status}): {url}')
        break
    except Exception as e:
        code = getattr(e, 'code', str(e))
        print(f'FAIL ({code}): {url}')
