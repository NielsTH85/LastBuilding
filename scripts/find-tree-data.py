import UnityPy, os, glob, json

bundle_dir = r'C:\ledata\Last Epoch_Data\StreamingAssets\aa\StandaloneWindows64'

# The game's MonoBehaviour scripts define skills and passive trees with 
# direct Sprite references. Let's find them in the gameplay bundles.
# actors_player_gameplay has 821 MonoBehaviours

bpath = os.path.join(bundle_dir, 'actors_player_gameplay_assets_all.bundle')
env = UnityPy.load(bpath)

# Load dup bundles for cross-refs
dup_bundles = sorted(glob.glob(os.path.join(bundle_dir, 'duplicateassetssortedbylabel_assets_duplicatebundle*.bundle')))
for db in dup_bundles[:20]:
    try:
        env.load_file(db)
    except:
        pass

print('Scanning MonoBehaviours in actors_player_gameplay...')
for obj in env.objects:
    if obj.type.name == 'MonoBehaviour':
        try:
            data = obj.read()
            tree = data.read_typetree()
            if not tree:
                continue
            keys = list(tree.keys()) if isinstance(tree, dict) else []
            # Look for passive tree or skill tree related MonoBehaviours
            if any(k in keys for k in ['passiveList', 'nodeList', 'passiveNodes', 'skillNodes',
                                        'treeData', 'passiveTree', 'specialisationTree',
                                        'skillTreeNodes', 'nodeData']):
                print(f'\n  Found MonoBehaviour with tree data!')
                print(f'  Keys: {keys}')
                # Print first few nodes
                for k in ['passiveList', 'nodeList', 'passiveNodes', 'skillNodes', 
                          'treeData', 'passiveTree', 'skillTreeNodes', 'nodeData']:
                    if k in tree:
                        v = tree[k]
                        if isinstance(v, list):
                            print(f'  {k}: {len(v)} entries')
                            if v:
                                print(f'    first entry type: {type(v[0]).__name__}')
                                if isinstance(v[0], dict):
                                    print(f'    first entry keys: {list(v[0].keys())[:15]}')
                                    # Look for icon/sprite references
                                    for ik in ['icon', 'sprite', 'iconSprite', 'nodeIcon']:
                                        if ik in v[0]:
                                            print(f'    {ik}: {v[0][ik]}')
        except Exception as e:
            pass

# Also check actors_player_specific_gameplay
print('\n\nScanning actors_player_specific_gameplay...')
bpath2 = os.path.join(bundle_dir, 'actors_player_specific_gameplay_assets_all.bundle')
env2 = UnityPy.load(bpath2)

count = 0
for obj in env2.objects:
    if obj.type.name == 'MonoBehaviour':
        try:
            data = obj.read()
            tree = data.read_typetree()
            if not tree or not isinstance(tree, dict):
                continue
            keys = list(tree.keys())
            # Show any MB that mentions 'icon', 'node', 'passive', 'tree'
            interesting = [k for k in keys if any(w in k.lower() for w in ['icon', 'node', 'passive', 'tree', 'skill'])]
            if interesting and count < 10:
                name = tree.get('m_Name', '')
                print(f'  MB name={name}, interesting_keys={interesting}, all_keys={keys[:15]}')
                count += 1
        except:
            pass
