"""Download passive tree background images from maxroll CDN."""
import urllib.request, os

out_dir = r'c:\eob\apps\planner-web\public\images\tree-bg'
os.makedirs(out_dir, exist_ok=True)

backgrounds = {
    'mage': 'https://assets-ng.maxroll.gg/leplanner/static/media/mage.ba8d6953.webp',
    'runemaster': 'https://assets-ng.maxroll.gg/leplanner/static/media/runemaster.a31dd33b.webp',
    'sorcerer': 'https://assets-ng.maxroll.gg/leplanner/static/media/sorcerer.2eb76c56.webp',
    'spellblade': 'https://assets-ng.maxroll.gg/leplanner/static/media/spellblade.a73a2044.webp',
    # Other classes for future use
    'sentinel': 'https://assets-ng.maxroll.gg/leplanner/static/media/sentinel.8f8ed3e6.webp',
    'voidknight': 'https://assets-ng.maxroll.gg/leplanner/static/media/voidknight.4655a9f4.webp',
    'forgeguard': 'https://assets-ng.maxroll.gg/leplanner/static/media/forgeguard.646ec8c8.webp',
    'paladin': 'https://assets-ng.maxroll.gg/leplanner/static/media/paladin.9d4a3b06.webp',
    'acolyte': 'https://assets-ng.maxroll.gg/leplanner/static/media/acolyte.32171daa.webp',
    'necromancer': 'https://assets-ng.maxroll.gg/leplanner/static/media/necromancer.5b806ab9.webp',
    'lich': 'https://assets-ng.maxroll.gg/leplanner/static/media/lich.ffc20839.webp',
    'warlock': 'https://assets-ng.maxroll.gg/leplanner/static/media/warlock.959d6d7e.webp',
    'primalist': 'https://assets-ng.maxroll.gg/leplanner/static/media/primalist.00e05041.webp',
    'beastmaster': 'https://assets-ng.maxroll.gg/leplanner/static/media/beastmaster.7f466c6b.webp',
    'shaman': 'https://assets-ng.maxroll.gg/leplanner/static/media/shaman.e790c6da.webp',
    'rogue': 'https://assets-ng.maxroll.gg/leplanner/static/media/rogue.16133b27.webp',
    'bladedancer': 'https://assets-ng.maxroll.gg/leplanner/static/media/bladedancer.f0822057.webp',
    'marksman': 'https://assets-ng.maxroll.gg/leplanner/static/media/marksman.5ccf208c.webp',
    'falconer': 'https://assets-ng.maxroll.gg/leplanner/static/media/falconer.114ab6f9.webp',
}

from PIL import Image
import io

for name, url in backgrounds.items():
    out_path = os.path.join(out_dir, f'{name}.webp')
    if os.path.exists(out_path):
        print(f"  SKIP {name} (exists)")
        continue
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        resp = urllib.request.urlopen(req, timeout=15)
        data = resp.read()
        with open(out_path, 'wb') as f:
            f.write(data)
        img = Image.open(io.BytesIO(data))
        print(f"  OK {name}: {len(data)} bytes, {img.size}")
    except Exception as e:
        print(f"  FAIL {name}: {e}")

print(f"\nDone! Files in {out_dir}")
