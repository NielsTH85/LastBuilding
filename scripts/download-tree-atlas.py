import urllib.request
from PIL import Image
import io, json

# Download the treeAtlas sprite sheet
url = "https://assets-ng.maxroll.gg/leplanner/static/media/treeAtlas.000f8466.webp"
print(f"Downloading {url}...")
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
resp = urllib.request.urlopen(req, timeout=30)
data = resp.read()
print(f"Downloaded {len(data)} bytes")

# Save raw webp
with open(r'c:\eob\scripts\treeAtlas.webp', 'wb') as f:
    f.write(data)

# Open with Pillow to analyze
img = Image.open(io.BytesIO(data))
print(f"Image size: {img.size}")
print(f"Mode: {img.mode}")

# From CSS: font-size:20px, width:1em, height:1em, background-size:16em auto
# So each sprite cell is 20x20 px, 16 cols
# But the actual sprite size might be different - let's calculate
cols = 16
cell_w = img.width // cols
cell_h = cell_w  # assuming square cells
rows = img.height // cell_h
total_sprites = cols * rows
print(f"Grid: {cols} cols x {rows} rows = {total_sprites} cells")
print(f"Cell size: {cell_w}x{cell_h}")

# Now let's look at the maxroll data to understand node icon values
with open(r'c:\eob\maxroll-game-data.json', 'r', encoding='utf-8') as f:
    game_data = json.load(f)

tree_atlas = game_data.get('treeAtlas', [])
print(f"\ntreeAtlas: {len(tree_atlas)} entries")
print(f"  Min value: {min(tree_atlas)}")
print(f"  Max value: {max(tree_atlas)}")
print(f"  First 20: {tree_atlas[:20]}")

# Look at icon values from actual nodes
# Check a few class trees
classes = game_data.get('classes', [])
for cls in classes[:3]:
    cls_name = cls.get('name', '?')
    trees = cls.get('trees', [])
    for tree in trees[:2]:
        tree_name = tree.get('name', '?')
        nodes = tree.get('nodes', [])
        icon_vals = [n.get('icon') for n in nodes if n.get('icon') is not None]
        if icon_vals:
            print(f"\n  {cls_name}/{tree_name}: {len(icon_vals)} nodes with icons")
            print(f"    Icon values: {icon_vals[:10]}")
            # Check if icon values are indices into treeAtlas or values IN treeAtlas
            for iv in icon_vals[:3]:
                if iv < len(tree_atlas):
                    print(f"    treeAtlas[{iv}] = {tree_atlas[iv]} (treating icon as INDEX)")
                idx_in_atlas = tree_atlas.index(iv) if iv in tree_atlas else None
                if idx_in_atlas is not None:
                    print(f"    treeAtlas.index({iv}) = {idx_in_atlas} (treating icon as VALUE)")
