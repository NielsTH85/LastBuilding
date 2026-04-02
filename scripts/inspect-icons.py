import json

with open(r'c:\eob\maxroll-game-data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# Look at skill data structure
skills = data.get('skills', [])
print('=== SKILLS ===')
for s in skills[:5]:
    sid = s.get('id')
    name = s.get('name')
    icon = s.get('icon')
    print(f'  id={sid}, name={name}, icon={icon}')

# Look at passive tree nodes
trees = data.get('passiveTrees', [])
for t in trees[:3]:
    tname = t.get('name')
    print(f'\n=== TREE: {tname} ===')
    nodes = t.get('nodes', [])
    for n in nodes[:5]:
        nid = n.get('id')
        nname = n.get('name')
        nicon = n.get('icon')
        print(f'  id={nid}, name={nname}, icon={nicon}')

# Check skill tree nodes too
print('\n=== SKILL TREE NODES ===')
for s in skills[:3]:
    sname = s.get('name')
    print(f'\n  Skill: {sname}')
    tree = s.get('tree', {})
    nodes = tree.get('nodes', [])
    for n in nodes[:3]:
        nid = n.get('id')
        nname = n.get('name')
        nicon = n.get('icon')
        print(f'    id={nid}, name={nname}, icon={nicon}')
