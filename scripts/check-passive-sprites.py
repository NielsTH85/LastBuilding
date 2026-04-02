import UnityPy, os, json

bundle_dir = r'C:\ledata\Last Epoch_Data\StreamingAssets\aa\StandaloneWindows64'

# Check mtx-sprites and mtx-portrait bundles
for bname in ['mtx-sprites_assets_all.bundle', 'mtx-portrait_visuals_assets_all.bundle']:
    bpath = os.path.join(bundle_dir, bname)
    if not os.path.exists(bpath):
        continue
    print(f'\n=== {bname} ===')
    env = UnityPy.load(bpath)
    
    type_counts = {}
    sprite_samples = []
    atlas_names = []
    for obj in env.objects:
        t = obj.type.name
        type_counts[t] = type_counts.get(t, 0) + 1
        if t == 'SpriteAtlas':
            d = obj.read()
            atlas_names.append((d.m_Name, len(d.m_RenderDataMap) if d.m_RenderDataMap else 0))
        elif t == 'Sprite' and len(sprite_samples) < 20:
            d = obj.read()
            sprite_samples.append(d.m_Name)
    
    print(f'  Types: {type_counts}')
    if atlas_names:
        print(f'  Atlases: {atlas_names}')
    if sprite_samples:
        print(f'  Sprite samples: {sprite_samples}')

# Now let's try a completely different approach - 
# The treeAtlas values might reference a DIFFERENT data format
# Let's check if they're x*256+y coordinates, or packed sprite indices
# Or maybe they reference sprites in the SpriteAtlas by render data keys

# Look at the "Shared" atlas which has 244 sprites - this probably contains
# the generic passive icons (buff icons etc)
print('\n\n=== Checking all sprites in skill_icons for passive-like names ===')
env2 = UnityPy.load(os.path.join(bundle_dir, 'skill_icons_assets_all.bundle'))
passive_keywords = ['buff', 'debuff', 'resist', 'armor', 'health', 'mana', 'ward', 
                     'damage', 'speed', 'crit', 'intel', 'strength', 'dex',
                     'elemental', 'fire-res', 'cold-res', 'lightning-res',
                     'generic', 'stat', 'attribute', 'shield']
    
for obj in env2.objects:
    if obj.type.name == 'Sprite':
        d = obj.read()
        name_lower = d.m_Name.lower()
        if any(k in name_lower for k in passive_keywords):
            print(f'  {d.m_Name}')
