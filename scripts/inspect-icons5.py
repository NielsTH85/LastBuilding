import json

with open(r'c:\eob\maxroll-game-data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# treeAtlas is a list of numbers (sprite IDs?)
ta = data.get('treeAtlas', [])
print(f'treeAtlas length: {len(ta)}')
print(f'First 20: {ta[:20]}')
print(f'Min: {min(ta)}, Max: {max(ta)}')

# The node.icon is an index into treeAtlas? Or a direct sprite ID?
st = data.get('skillTrees', {})
tree = st.get('mg-1', {})
nodes = tree.get('nodes', {})

print('\nMage passive tree node icon values:')
icon_vals = []
for nid, n in sorted(nodes.items(), key=lambda x: int(x[0])):
    icon = n.get('icon')
    if icon is not None:
        icon_vals.append(icon)
        if int(nid) < 10:
            print(f'  Node {nid} ({n.get("nodeName")}): icon={icon}')

print(f'\nUnique icon values: {len(set(icon_vals))}')
print(f'Icon range: {min(icon_vals)} - {max(icon_vals)}')

# Check if icon values are indices into treeAtlas
print(f'\ntreeAtlas[16396] = {ta[16396] if 16396 < len(ta) else "OUT OF RANGE"}')
print(f'treeAtlas has indexes 0-{len(ta)-1}')

# So it seems icon IS the index? Or the value AT that index?
# Let's check: if icon=16396, is 16396 an index or directly a sprite?
# treeAtlas has 1129 entries with values like 15951, 14837, etc.
# 16396 > 1129, so it can't be an index into treeAtlas

# Must be a direct reference to a sprite somehow
# Let's see what these numbers map to in the asset bundles

# Also check the abilities structure
abilities = data.get('abilities', {})
# Find Mage abilities
for name, ab in list(abilities.items()):
    if 'firebal' in name.lower() or 'mana strike' in name.lower():
        print(f'\nAbility {name}: {dict(list(ab.items())[:10]) if isinstance(ab, dict) else ab}')

# Check abilityList
al = data.get('abilityList', [])
print(f'\nabilityList length: {len(al)}')
for item in al[:5]:
    if isinstance(item, dict):
        print(f'  {dict(list(item.items())[:8])}')
    else:
        print(f'  {item}')

# Check playerAbilityList
pal = data.get('playerAbilityList', [])
print(f'\nplayerAbilityList length: {len(pal)}')
for item in pal[:5]:
    if isinstance(item, dict):
        print(f'  {dict(list(item.items())[:8])}')
    else:
        print(f'  {item}')
