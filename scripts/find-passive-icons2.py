import UnityPy, os, glob

bundle_dir = r'C:\ledata\Last Epoch_Data\StreamingAssets\aa\StandaloneWindows64'

# The treeAtlas uses numeric IDs like 15951, 14837 etc. 
# These are likely sprite indices in a larger sprite atlas/sheet
# Let's look at what the gear-sprites bundle has (60MB - could contain item/passive icons)
# And actors_player_gameplay (may have skill tree data references)

candidates = [
    'gear-sprites_visuals_assets_all.bundle',
    'actors_player_gameplay_assets_all.bundle',
    'actors_misc_gameplay_assets_all.bundle',
]

for bname in candidates:
    bpath = os.path.join(bundle_dir, bname)
    if not os.path.exists(bpath):
        continue
    size_mb = os.path.getsize(bpath) // 1024 // 1024
    print(f'\n=== {bname} ({size_mb}MB) ===')
    try:
        env = UnityPy.load(bpath)
        type_counts = {}
        atlas_info = []
        sprite_samples = []
        tex_samples = []
        for obj in env.objects:
            t = obj.type.name
            type_counts[t] = type_counts.get(t, 0) + 1
            if t == 'SpriteAtlas':
                d = obj.read()
                atlas_info.append((d.m_Name, len(d.m_RenderDataMap) if d.m_RenderDataMap else 0))
            elif t == 'Sprite' and len(sprite_samples) < 30:
                d = obj.read()
                sprite_samples.append(d.m_Name)
            elif t == 'Texture2D' and len(tex_samples) < 20:
                d = obj.read()
                tex_samples.append((d.m_Name, d.m_Width, d.m_Height))
        
        print(f'  Types: { {k:v for k,v in sorted(type_counts.items())} }')
        if atlas_info:
            print(f'  Atlases: {atlas_info}')
        if sprite_samples:
            print(f'  Sprite samples: {sprite_samples}')
        if tex_samples:
            print(f'  Texture samples: {tex_samples}')
    except Exception as e:
        print(f'  Error: {e}')
