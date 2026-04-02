import json
from PIL import Image

with open(r'c:\eob\maxroll-game-data.json', 'r', encoding='utf-8') as f:
    game_data = json.load(f)

tree_atlas = game_data.get('treeAtlas', [])
print(f"treeAtlas: {len(tree_atlas)} entries")
print(f"  Values are UNIQUE: {len(set(tree_atlas)) == len(tree_atlas)}")

# Build reverse map: icon_id -> sprite_index
reverse_map = {}
for idx, val in enumerate(tree_atlas):
    reverse_map[val] = idx

# Check node icon values
all_icon_vals = set()
for cls in game_data.get('classes', []):
    cls_name = cls.get('name', '?')
    for tree in cls.get('trees', []):
        tree_name = tree.get('name', '?')
        for node in tree.get('nodes', []):
            icon = node.get('icon')
            if icon is not None:
                all_icon_vals.add(icon)
                # Check if this icon value appears in treeAtlas
                if icon in reverse_map:
                    sprite_idx = reverse_map[icon]
                else:
                    sprite_idx = None
                    
    # Also check skills
    for skill in cls.get('skills', []):
        for snode in skill.get('nodes', []):
            icon = snode.get('icon')
            if icon is not None:
                all_icon_vals.add(icon)

print(f"\nTotal unique icon values across all nodes: {len(all_icon_vals)}")
in_atlas = sum(1 for v in all_icon_vals if v in reverse_map)
not_in_atlas = sum(1 for v in all_icon_vals if v not in reverse_map)
print(f"  In treeAtlas: {in_atlas}")
print(f"  NOT in treeAtlas: {not_in_atlas}")

# Show some examples
print("\nExamples (first Mage tree):")
mage = [c for c in game_data['classes'] if c['name'] == 'Mage'][0]
for tree in mage['trees'][:2]:
    print(f"\n  Tree: {tree['name']}")
    for node in tree['nodes'][:5]:
        icon = node.get('icon')
        name = node.get('name', '?')
        if icon in reverse_map:
            si = reverse_map[icon]
            col = si % 16
            row = si // 16
            print(f"    {name}: icon={icon} -> sprite_idx={si} -> ({col}, {row})")
        else:
            print(f"    {name}: icon={icon} -> NOT in treeAtlas")

# Now verify by looking at the sprite sheet
img = Image.open(r'c:\eob\scripts\treeAtlas.webp')
print(f"\nSprite sheet: {img.size}, cell=64x64, grid=16x{img.height//64}")

# Extract a test sprite to verify
si = reverse_map.get(list(all_icon_vals)[0], 0)
col = si % 16
row = si // 16
sprite = img.crop((col*64, row*64, (col+1)*64, (row+1)*64))
sprite.save(r'c:\eob\scripts\test_sprite.png')
print(f"Saved test sprite from position ({col}, {row})")

# Check if icon values in skill nodes might use a DIFFERENT system (icons array)
icons_data = game_data.get('icons', {})
print(f"\n'icons' field: type={type(icons_data).__name__}")
if isinstance(icons_data, dict):
    print(f"  Keys: {list(icons_data.keys())[:20]}")
elif isinstance(icons_data, list):
    print(f"  Length: {len(icons_data)}, first 5: {icons_data[:5]}")
