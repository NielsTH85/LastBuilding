import json

with open(r'c:\eob\maxroll-game-data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# The treeAtlas has 1129 entries with large values like 15951, 14837...
# Node icon values are also in the same range
# Let's check: are node icon values exactly the values in treeAtlas?
ta = data.get('treeAtlas', [])
ta_set = set(ta)

st = data.get('skillTrees', {})
tree = st.get('mg-1', {})
nodes = tree.get('nodes', {})

print('Are all Mage node icons in treeAtlas?')
for nid, n in sorted(nodes.items(), key=lambda x: int(x[0]))[:20]:
    icon = n.get('icon')
    in_atlas = icon in ta_set
    idx = ta.index(icon) if in_atlas else -1
    print(f'  Node {nid} ({n.get("nodeName")}): icon={icon}, in_atlas={in_atlas}, atlas_idx={idx}')

# The treeAtlas values look like they're positions in a sprite atlas/sheet
# Maybe they're indices into the SpriteAtlas textures in the bundle
# or maybe maxroll uses a different URL pattern

# Let's check what the SpriteAtlas structure looks like
print('\n=== Try fetching from maxroll with different URL patterns ===')
# Maybe the pattern is something like atlas_col_row
# Or maybe the icons are served as a sprite sheet
# Let's check if maxroll-adapter.ts has any icon handling
