import json

with open(r'c:\eob\maxroll-game-data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# Check treeAtlas entries - first 10
ta = data.get('treeAtlas', [])
print(f'=== TREE ATLAS: {len(ta)} entries ===')
for item in ta[:10]:
    print(f'  {item}')

# Check a skill tree
st = data.get('skillTrees', {})
keys = list(st.keys())[:5]
print(f'\n=== SKILL TREE KEYS (first 5 of {len(st)}): {keys} ===')
for k in keys[:2]:
    v = st[k]
    if isinstance(v, dict):
        print(f'\n  Tree {k} keys: {list(v.keys())}')
        for sk, sv in list(v.items())[:5]:
            if isinstance(sv, (list, dict)):
                print(f'    {sk}: type={type(sv).__name__}, len={len(sv)}')
            else:
                print(f'    {sk}: {sv}')

# Check classes structure
classes = data.get('classes', [])
print(f'\n=== CLASSES ===')
for c in classes[:3]:
    if isinstance(c, dict):
        print(f'  keys: {list(c.keys())[:15]}')
        print(f'  name: {c.get("name")}, id: {c.get("id")}')
        passives = c.get('passives', None)
        if passives:
            print(f'  passives type: {type(passives).__name__}')
            if isinstance(passives, list) and passives:
                p = passives[0]
                if isinstance(p, dict):
                    print(f'    first passive keys: {list(p.keys())[:10]}')
                    print(f'    first passive: {str(p)[:300]}')
