import json
d = json.load(open(r'c:\eob\maxroll-game-data.json', encoding='utf-8'))
st = d['skillTrees']
mg = st['mg-1']

print(f"mg-1 keys: {list(mg.keys())}")
nodes = mg['nodes']
print(f"nodes type: {type(nodes)}, len: {len(nodes)}")

# First node
n0 = nodes[0]
print(f"\nFirst node type: {type(n0)}")
if isinstance(n0, dict):
    for k, v in n0.items():
        val = str(v)[:120]
        print(f"  {k}: {val}")
elif isinstance(n0, list):
    print(f"  length: {len(n0)}")
    for i, item in enumerate(n0[:5]):
        print(f"  [{i}]: {str(item)[:100]}")
else:
    print(f"  value: {n0}")

# A few more nodes
print("\nNodes 1-3:")
for i in range(1, min(4, len(nodes))):
    n = nodes[i]
    if isinstance(n, dict):
        print(f"  [{i}] name={n.get('name')}, icon={n.get('icon')}, type={n.get('type')}")
    else:
        print(f"  [{i}] {str(n)[:100]}")
