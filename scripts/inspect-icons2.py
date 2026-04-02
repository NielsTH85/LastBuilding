import json

with open(r'c:\eob\maxroll-game-data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# Check icons structure
icons = data.get('icons', {})
print(f'=== ICONS: type={type(icons).__name__}, len={len(icons) if hasattr(icons, "__len__") else "?"} ===')
if isinstance(icons, dict):
    items = list(icons.items())[:20]
    for k, v in items:
        print(f'  {k}: {v}')
elif isinstance(icons, list):
    for item in icons[:20]:
        print(f'  {item}')

# Check abilities  
abilities = data.get('abilities', {})
print(f'\n=== ABILITIES: type={type(abilities).__name__}, len={len(abilities)} ===')
if isinstance(abilities, dict):
    items = list(abilities.items())[:5]
    for k, v in items:
        if isinstance(v, dict):
            print(f'  {k}: icon={v.get("icon")}, name={v.get("name")}, iconOverride={v.get("iconOverride")}')
        else:
            print(f'  {k}: {str(v)[:200]}')
elif isinstance(abilities, list):
    for item in abilities[:5]:
        if isinstance(item, dict):
            print(f'  id={item.get("id")}, icon={item.get("icon")}, name={item.get("name")}')

# Check skillTrees
st = data.get('skillTrees', {})
print(f'\n=== SKILL TREES: type={type(st).__name__}, len={len(st)} ===')
if isinstance(st, dict):
    items = list(st.items())[:3]
    for k, v in items:
        if isinstance(v, dict):
            nodes = v.get('nodes', v.get('nodeList', []))
            print(f'  tree {k}: {len(nodes) if isinstance(nodes, list) else "?"} nodes')
            if isinstance(nodes, list) and nodes:
                n = nodes[0]
                if isinstance(n, dict):
                    print(f'    first node: icon={n.get("icon")}, name={n.get("name")}')

# Check classes
classes = data.get('classes', {})
print(f'\n=== CLASSES: type={type(classes).__name__}, len={len(classes)} ===')
if isinstance(classes, dict):
    for k, v in list(classes.items())[:5]:
        if isinstance(v, dict):
            print(f'  {k}: name={v.get("name")}, icon={v.get("icon")}')
            # Check passives
            passives = v.get('passives', v.get('passiveTree', None))
            if passives:
                print(f'    passives type={type(passives).__name__}')

# Check treeAtlas
ta = data.get('treeAtlas', {})
print(f'\n=== TREE ATLAS: type={type(ta).__name__}, len={len(ta)} ===')
if isinstance(ta, dict):
    items = list(ta.items())[:5]
    for k, v in items:
        print(f'  {k}: {str(v)[:200]}')
