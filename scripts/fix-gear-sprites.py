"""Fix remaining unmatched sprites using raw names + case insensitive matching."""
import UnityPy, json, os

BUNDLE = r'C:\ledata\Last Epoch_Data\StreamingAssets\aa\StandaloneWindows64\gear-sprites_visuals_assets_all.bundle'
OUT_DIR = r'c:\eob\apps\planner-web\public\images\items'

env = UnityPy.load(BUNDLE)
sprites = {}
for obj in env.objects:
    if obj.type.name == 'Sprite':
        d = obj.read()
        sprites[d.m_Name] = obj

sprites_lower = {k.lower(): k for k in sprites}

with open('maxroll-game-data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

with open(r'c:\eob\packages\game-data\src\data\equipment-import.json', 'r', encoding='utf-8') as f:
    equip = json.load(f)

# Build raw name lookup
raw_names = {}
equip_types = [0,1,2,3,4,5,6,7,8,9,10,12,13,14,15,16,17,18,19,20,21,22,23,25,26,27,28,29,30,31,32,33,41]
for it in data['itemTypes']:
    btid = it['baseTypeID']
    if btid not in equip_types:
        continue
    for sub in it.get('subItems', []):
        raw_names[f"{btid}_{sub['subTypeID']}"] = sub.get('name', '')

# Load existing mapping
mapping_path = r'c:\eob\packages\game-data\src\data\item-sprites.json'
with open(mapping_path, 'r', encoding='utf-8') as f:
    mapping = json.load(f)

fixed = 0
still_missing = []
for item in equip['itemBases']:
    item_id = f"{item['baseTypeId']}_{item['subTypeId']}"
    if item_id in mapping:
        continue

    raw = raw_names.get(item_id, '')
    candidates = [
        item['name'].replace(' ', '_'),
        raw.replace(' ', '_'),
        item['name'].replace(' ', '_').replace("'", ''),
        raw.replace(' ', '_').replace("'", ''),
        item['name'].replace(' ', '_').replace("'", 's'),
        raw.replace(' ', '_').replace("'", 's'),
    ]

    found = None
    for c in candidates:
        if c in sprites:
            found = c
            break
        if c.lower() in sprites_lower:
            found = sprites_lower[c.lower()]
            break

    if found:
        filename = f'{item_id}.png'
        mapping[item_id] = filename
        out_path = os.path.join(OUT_DIR, filename)
        if not os.path.exists(out_path):
            d = sprites[found].read()
            d.image.save(out_path)
        fixed += 1
        print(f'Fixed: {item_id} ({item["name"]}) -> {found}')
    else:
        still_missing.append((item_id, item['name'], raw))

print(f'\nExtra fixed: {fixed}')
print(f'Total mapped: {len(mapping)}/{len(equip["itemBases"])}')
print(f'Still missing: {len(still_missing)}')
for iid, name, raw in still_missing:
    print(f'  {iid}: {name} (raw: {raw})')

with open(mapping_path, 'w', encoding='utf-8') as f:
    json.dump(mapping, f, indent=2)
print('Updated mapping saved.')
