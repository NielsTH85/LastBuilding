import json

with open(r'c:\eob\maxroll-game-data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# Look at a skill tree node structure
st = data.get('skillTrees', {})

# Find a Mage-related skill tree
# The treeID for mage class should be in classes
classes = data.get('classes', [])
for c in classes:
    if 'mage' in c.get('className', '').lower():
        print(f'Mage class: className={c["className"]}, classID={c["classID"]}, treeID={c["treeID"]}')

# Check the passive tree (class tree)
# Tree ac-1 had 109 nodes and masteries - that looks like a class tree
tree = st.get('ac-1', {})
if tree:
    nodes = tree.get('nodes', {})
    first_keys = list(nodes.keys())[:5]
    print(f'\nTree ac-1: ability={tree.get("ability")}, {len(nodes)} nodes')
    for k in first_keys:
        n = nodes[k]
        if isinstance(n, dict):
            print(f'  Node {k} keys: {list(n.keys())}')
            print(f'  Node {k}: icon={n.get("icon")}, name={n.get("name")}, iconOverride={n.get("iconOverride")}')
            break

# Find the Mage passive tree
for tree_id, tree in st.items():
    if isinstance(tree, dict) and tree.get('masteries'):
        masteries = tree.get('masteries', [])
        for m in masteries:
            if isinstance(m, dict) and 'mage' in str(m).lower():
                print(f'\nFound mage-related mastery tree: {tree_id}')
                break
        # If class tree, print info
        if tree.get('unlockableAbilities'):
            classes_in_tree = [m.get('name', '') if isinstance(m, dict) else '' for m in masteries]
            print(f'  tree {tree_id}: masteries={classes_in_tree}, abilities={len(tree.get("unlockableAbilities",[]))}')

# Look at a specific node
for tree_id in ['mg-1']:
    tree = st.get(tree_id, {})
    if tree:
        nodes = tree.get('nodes', {})
        print(f'\nTree {tree_id}: {len(nodes)} nodes, ability={tree.get("ability")}')
        for nid, n in list(nodes.items())[:3]:
            if isinstance(n, dict):
                print(f'  Node {nid}: {dict(list(n.items())[:8])}')
