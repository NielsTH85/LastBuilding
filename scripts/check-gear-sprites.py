import UnityPy, os, glob, json

bundle_dir = r'C:\ledata\Last Epoch_Data\StreamingAssets\aa\StandaloneWindows64'

# Load gear-sprites and check for numeric sprite names
env = UnityPy.load(os.path.join(bundle_dir, 'gear-sprites_visuals_assets_all.bundle'))

# Collect all sprite names
sprite_names = []
numeric_sprites = []
for obj in env.objects:
    if obj.type.name == 'Sprite':
        d = obj.read()
        sprite_names.append(d.m_Name)
        # Check if name is numeric
        try:
            int(d.m_Name)
            numeric_sprites.append(int(d.m_Name))
        except ValueError:
            pass

print(f'Total sprites: {len(sprite_names)}')
print(f'Numeric names: {len(numeric_sprites)}')
if numeric_sprites:
    numeric_sprites.sort()
    print(f'Range: {min(numeric_sprites)} - {max(numeric_sprites)}')
    print(f'First 30: {numeric_sprites[:30]}')

# Compare with treeAtlas
with open(r'c:\eob\maxroll-game-data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)
ta = data.get('treeAtlas', [])
ta_set = set(ta)
found = ta_set.intersection(set(numeric_sprites))
print(f'\ntreeAtlas entries: {len(ta)}')
print(f'treeAtlas values found in gear-sprites: {len(found)}')
if found:
    print(f'Sample matches: {list(found)[:20]}')
