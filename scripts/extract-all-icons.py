import UnityPy, os, glob

bundle_dir = r'C:\ledata\Last Epoch_Data\StreamingAssets\aa\StandaloneWindows64'
skill_bundle = os.path.join(bundle_dir, 'skill_icons_assets_all.bundle')

env = UnityPy.load(skill_bundle)

# Load dup bundles for texture resolution
dup_bundles = sorted(glob.glob(os.path.join(bundle_dir, 'duplicateassetssortedbylabel_assets_duplicatebundle*.bundle')))
print(f'Loading {len(dup_bundles)} duplicate bundles for texture resolution...')
for db in dup_bundles:
    try:
        env.load_file(db)
    except:
        pass
print('Done loading bundles.')

out = r'C:\eob\apps\planner-web\public\icons\all'
os.makedirs(out, exist_ok=True)

# Export ALL sprites from the bundle
exported = 0
failed = 0
for obj in env.objects:
    if obj.type.name == 'Sprite':
        data = obj.read()
        name = data.m_Name
        fname = name.replace(' ', '-').lower() + '.png'
        fpath = os.path.join(out, fname)
        try:
            img = data.image
            img.save(fpath)
            exported += 1
        except Exception as e:
            failed += 1
            if failed <= 5:
                print(f'FAIL: {name}: {e}')

print(f'\nExported: {exported}, Failed: {failed}')
