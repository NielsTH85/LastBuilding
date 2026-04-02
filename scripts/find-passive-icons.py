import UnityPy, os, glob

bundle_dir = r'C:\ledata\Last Epoch_Data\StreamingAssets\aa\StandaloneWindows64'

# Look at the defaultlocalgroup bundle (404MB - the big one) and gear-sprites for SpriteAtlases
# Also check ui_minimaps and other UI bundles
candidates = [
    'defaultlocalgroup_assets_all.bundle',
    'ui_healthbars_assets_all.bundle',
]

for bname in candidates:
    bpath = os.path.join(bundle_dir, bname)
    if not os.path.exists(bpath):
        continue
    print(f'\n=== {bname} ({os.path.getsize(bpath)//1024//1024}MB) ===')
    try:
        env = UnityPy.load(bpath)
        type_counts = {}
        sprite_names = []
        tex_names = []
        atlas_names = []
        for obj in env.objects:
            t = obj.type.name
            type_counts[t] = type_counts.get(t, 0) + 1
            if t == 'Sprite':
                d = obj.read()
                sprite_names.append(d.m_Name)
            elif t == 'Texture2D':
                d = obj.read()
                tex_names.append((d.m_Name, d.m_Width, d.m_Height))
            elif t == 'SpriteAtlas':
                d = obj.read()
                atlas_names.append(d.m_Name)
        
        print(f'  Types: {type_counts}')
        if atlas_names:
            print(f'  Atlases: {atlas_names}')
        if sprite_names:
            # Show sprites that might be passive tree related
            interesting = [s for s in sprite_names if any(k in s.lower() for k in ['passive', 'tree', 'node', 'icon'])]
            print(f'  Total sprites: {len(sprite_names)}')
            if interesting:
                print(f'  Interesting sprites: {interesting[:30]}')
            else:
                print(f'  First 20 sprites: {sprite_names[:20]}')
        if tex_names:
            interesting_tex = [t for t in tex_names if any(k in t[0].lower() for k in ['passive', 'tree', 'node', 'icon', 'atlas'])]
            print(f'  Total textures: {len(tex_names)}')
            if interesting_tex:
                print(f'  Interesting textures: {interesting_tex[:20]}')
    except Exception as e:
        print(f'  Error: {e}')
