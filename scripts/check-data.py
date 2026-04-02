import json
d = json.load(open(r'c:\eob\maxroll-game-data.json', encoding='utf-8'))
st = d['skillTrees']

# Find mage tree  
for key in st:
    tree = st[key]
    if isinstance(tree, dict):
        name = tree.get('name', key)
        nodes = tree.get('nodes', [])
        if 'mg' in key.lower() or 'mage' in str(name).lower():
            print(f"Tree: {key}, name={name}, nodes={len(nodes)}")
            if isinstance(nodes, list) and nodes:
                print(f"  Node keys: {list(nodes[0].keys())[:20]}")
                for n in nodes[:8]:
                    print(f"    name={n.get('name')}, icon={n.get('icon')}")

# Show ALL tree keys with their names
print("\nAll trees:")
for key in list(st.keys())[:30]:
    tree = st[key]
    if isinstance(tree, dict):
        name = tree.get('name', '?')
        nodes = tree.get('nodes', [])
        ncount = len(nodes) if isinstance(nodes, list) else '?'
        print(f"  {key}: {name} ({ncount} nodes)")

# Check icons object too
icons = d.get('icons')
print(f"\nicons: type={type(icons)}")
if isinstance(icons, dict):
    print(f"  keys: {list(icons.keys())[:20]}")
    k0 = list(icons.keys())[0]
    print(f"  icons['{k0}']: {icons[k0][:5] if isinstance(icons[k0], list) else icons[k0]}")
elif isinstance(icons, list):
    print(f"  len={len(icons)}, first few: {icons[:5]}")
