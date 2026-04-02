"""
Slice the treeAtlas sprite sheet into individual 64x64 PNGs.
Each icon is named by its game icon ID (the value from the treeAtlas array).
The treeAtlas array maps: index -> icon_id, where index gives the sprite position
on the sheet (col = index % 16, row = index // 16, pixel = col*64, row*64).
"""
import json, os
from PIL import Image

# Load data
with open(r'c:\eob\maxroll-game-data.json', encoding='utf-8') as f:
    data = json.load(f)

tree_atlas = data['treeAtlas']
img = Image.open(r'c:\eob\scripts\treeAtlas.webp')
print(f"Sprite sheet: {img.size}, {len(tree_atlas)} icons to extract")

# Output directory
out_dir = r'c:\eob\apps\planner-web\public\icons\tree'
os.makedirs(out_dir, exist_ok=True)

cell_size = 64
cols = 16
extracted = 0

for idx, icon_id in enumerate(tree_atlas):
    col = idx % cols
    row = idx // cols
    x = col * cell_size
    y = row * cell_size
    
    # Bounds check
    if y + cell_size > img.height:
        print(f"  WARNING: index {idx} (icon {icon_id}) exceeds sheet height")
        continue
    
    sprite = img.crop((x, y, x + cell_size, y + cell_size))
    
    # Check if sprite is not fully transparent
    if sprite.mode == 'RGBA':
        bbox = sprite.getbbox()
        if bbox is None:
            continue  # skip empty sprites
    
    sprite.save(os.path.join(out_dir, f'{icon_id}.png'))
    extracted += 1

print(f"Extracted {extracted} icons to {out_dir}")

# Verify: check that all Mage tree node icons were extracted
st = data['skillTrees']
mg_nodes = st['mg-1']['nodes']
missing = 0
for node_key, node in mg_nodes.items():
    icon_id = node.get('icon')
    if icon_id is not None:
        path = os.path.join(out_dir, f'{icon_id}.png')
        if not os.path.exists(path):
            print(f"  MISSING: node '{node.get('nodeName', node_key)}' icon={icon_id}")
            missing += 1

print(f"Mage tree: {len(mg_nodes)} nodes, {missing} missing icons")
