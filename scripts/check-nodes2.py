import json
d = json.load(open(r'c:\eob\maxroll-game-data.json', encoding='utf-8'))
st = d['skillTrees']
mg = st['mg-1']
nodes = mg['nodes']

print(f"nodes type: dict, len: {len(nodes)}")
keys = list(nodes.keys())
print(f"first 10 keys: {keys[:10]}")

# Look at first node
k0 = keys[0]
n0 = nodes[k0]
print(f"\nNode '{k0}' type: {type(n0)}")
if isinstance(n0, dict):
    for k, v in n0.items():
        val = str(v)[:120]
        print(f"  {k}: {val}")

# Show a few more
for k in keys[1:4]:
    n = nodes[k]
    if isinstance(n, dict):
        print(f"\nNode '{k}': name={n.get('name')}, icon={n.get('icon')}")
    else:
        print(f"\nNode '{k}': {str(n)[:100]}")

# Collect all icon values
all_icons = set()
for k in keys:
    n = nodes[k]
    if isinstance(n, dict):
        icon = n.get('icon')
        if icon is not None:
            all_icons.add(icon)
print(f"\nUnique icon values in mg-1: {len(all_icons)}")
print(f"Sample icons: {sorted(list(all_icons))[:20]}")

# Check if these are in treeAtlas
tree_atlas = d['treeAtlas']
reverse = {v: i for i, v in enumerate(tree_atlas)}
in_atlas = [v for v in all_icons if v in reverse]
not_in = [v for v in all_icons if v not in reverse]
print(f"In treeAtlas: {len(in_atlas)}")
print(f"Not in treeAtlas: {len(not_in)}")
if in_atlas:
    for v in sorted(in_atlas)[:5]:
        idx = reverse[v]
        print(f"  icon={v} -> treeAtlas index={idx} -> col={idx%16}, row={idx//16}")
if not_in:
    print(f"Missing from treeAtlas: {sorted(not_in)[:10]}")
