import UnityPy, os, glob, json

bundle_dir = r'C:\ledata\Last Epoch_Data\StreamingAssets\aa\StandaloneWindows64'

# IL2CPP builds don't have type trees by default.
# But we can check if there's a global-metadata.dat or type tree data
# Let's look for .dat files that might have schema info

# Alternative: let's look at the Sprite objects more carefully.
# Each Sprite has a path_id. The treeAtlas numbers might map to some internal Unity field.
# Let's check if the treeAtlas VALUES correspond to anything in the sprite metadata.

skill_bundle = os.path.join(bundle_dir, 'skill_icons_assets_all.bundle')
env = UnityPy.load(skill_bundle)

# Load ALL dup bundles for complete data
dup_bundles = sorted(glob.glob(os.path.join(bundle_dir, 'duplicateassetssortedbylabel_assets_duplicatebundle*.bundle')))
for db in dup_bundles:
    try:
        env.load_file(db)
    except:
        pass

# Collect sprite data with various IDs
sprites_data = []
for obj in env.objects:
    if obj.type.name == 'Sprite':
        d = obj.read()
        sprites_data.append({
            'name': d.m_Name,
            'path_id': obj.path_id,
            # RD might have atlas rect info
        })

# Load treeAtlas
with open(r'c:\eob\maxroll-game-data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)
ta_values = set(data.get('treeAtlas', []))

print(f'Total sprites: {len(sprites_data)}')
print(f'TreeAtlas unique values: {len(ta_values)}')
print(f'TreeAtlas range: {min(ta_values)} - {max(ta_values)}')

# Check if any path_id modulo something maps to treeAtlas values
# Or check if treeAtlas values are sequential sprite indices in some order

# Let's try: what if the treeAtlas values are the position of the icon
# in a sprite sheet? Like row*cols + col?
# With 128x128 sprites in a 2048x2048 texture, that's 16x16 = 256 sprites per sheet.
# Let's check the texture names for sprite sheets

# Actually, maybe the treeAtlas values are Unity SpriteRenderer.sprite.GetInstanceID() values
# These would be scene-specific instance IDs not stored in bundles

# Let's try yet another approach: download the sprite sheet that maxroll uses
# Their frontend must load it from their CDN

# Check if the image atlas is served at known maxroll endpoints
import urllib.request

# Try tree atlas spritesheet
urls = [
    'https://assets-ng.maxroll.gg/leplanner/game/treeAtlas.webp',
    'https://assets-ng.maxroll.gg/leplanner/game/treeAtlas.png',
    'https://assets-ng.maxroll.gg/leplanner/tree-atlas.webp',
    'https://assets-ng.maxroll.gg/leplanner/img/tree-atlas.webp',
    'https://assets-ng.maxroll.gg/leplanner/img/treeAtlas.webp',
    'https://assets-ng.maxroll.gg/leplanner/icons/treeAtlas.webp',
]

for url in urls:
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        resp = urllib.request.urlopen(req, timeout=5)
        print(f'FOUND ({resp.status}, {resp.headers.get("Content-Length","?")}b): {url}')
    except Exception as e:
        code = getattr(e, 'code', str(e))
        # Don't print 404s
        if '404' not in str(code):
            print(f'({code}): {url}')
