import UnityPy, os, glob

bundle_dir = r'C:\ledata\Last Epoch_Data\StreamingAssets\aa\StandaloneWindows64'

# Find bundles that might contain passive tree icons / tree atlas sprites
# The treeAtlas uses sprite IDs like 15951, 14837 etc.
# These are likely in a SpriteAtlas

# Let's check what SpriteAtlases exist in the skill_icons bundle
skill_bundle = os.path.join(bundle_dir, 'skill_icons_assets_all.bundle')
env = UnityPy.load(skill_bundle)

# Load dup bundles for texture resolution
dup_bundles = glob.glob(os.path.join(bundle_dir, 'duplicateassetssortedbylabel_assets_duplicatebundle*.bundle'))
for db in dup_bundles[:50]:
    try:
        env.load_file(db)
    except:
        pass

print('=== SpriteAtlases ===')
for obj in env.objects:
    if obj.type.name == 'SpriteAtlas':
        data = obj.read()
        print(f'  Name: {data.m_Name}, path_id: {obj.path_id}')
        # Check the packed sprites
        rd = data.m_RenderDataMap
        print(f'  RenderDataMap entries: {len(rd) if rd else 0}')

print('\n=== Texture2Ds ===')
for obj in env.objects:
    if obj.type.name == 'Texture2D':
        data = obj.read()
        print(f'  Name: {data.m_Name}, size: {data.m_Width}x{data.m_Height}, path_id: {obj.path_id}')

# Also check how many sprites, and what their path_ids are
print('\n=== Sprite path_ids (first 20) ===')
sprites = []
for obj in env.objects:
    if obj.type.name == 'Sprite':
        data = obj.read()
        sprites.append((obj.path_id, data.m_Name))
        
sprites.sort()
for pid, name in sprites[:20]:
    print(f'  path_id={pid}: {name}')
print(f'  ... total: {len(sprites)}')
print(f'  path_id range: {sprites[0][0]} - {sprites[-1][0]}')
