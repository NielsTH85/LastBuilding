"""Extract unique item sprites from the gear-sprites bundle."""
import UnityPy, json, os

BUNDLE = r'C:\ledata\Last Epoch_Data\StreamingAssets\aa\StandaloneWindows64\gear-sprites_visuals_assets_all.bundle'
OUT_DIR = r'c:\eob\apps\planner-web\public\images\items\uniques'

os.makedirs(OUT_DIR, exist_ok=True)

env = UnityPy.load(BUNDLE)
sprites = {}
for obj in env.objects:
    if obj.type.name == 'Sprite':
        d = obj.read()
        sprites[d.m_Name] = obj

sprites_lower = {k.lower(): k for k in sprites}

# Load uniques data
with open(r'c:\eob\packages\game-data\src\data\uniques-import.json', 'r', encoding='utf-8') as f:
    uniques = json.load(f)

matched = 0
missing = []
unique_mapping = {}

for u in uniques:
    uid = u['uniqueID']
    name = u.get('name', '')
    display = u.get('displayName', '')
    
    # Try display name first, then raw name
    candidates = []
    for n in [display, name]:
        if not n:
            continue
        key = n.replace(' ', '_').replace("'", 's').replace("'", '')
        candidates.append(key)
        key2 = n.replace(' ', '_').replace("'", '').replace("'", '')
        candidates.append(key2)
        key3 = n.replace(' ', '_')
        candidates.append(key3)
    
    found = None
    for c in candidates:
        if c in sprites:
            found = c
            break
        if c.lower() in sprites_lower:
            found = sprites_lower[c.lower()]
            break
    
    if found:
        filename = f"u{uid}.png"
        unique_mapping[str(uid)] = filename
        out_path = os.path.join(OUT_DIR, filename)
        if not os.path.exists(out_path):
            d = sprites[found].read()
            d.image.save(out_path)
        matched += 1
    else:
        missing.append((uid, name, display))

print(f"Unique sprites matched: {matched}/{len(uniques)}")
print(f"Missing: {len(missing)}")
if missing:
    print("\nMissing (first 30):")
    for uid, name, disp in missing[:30]:
        print(f"  #{uid}: {name} (display: {disp})")

# Save unique mapping
mapping_path = r'c:\eob\packages\game-data\src\data\unique-sprites.json'
with open(mapping_path, 'w', encoding='utf-8') as f:
    json.dump(unique_mapping, f, indent=2)
print(f"\nSaved {len(unique_mapping)} unique sprite mappings")
