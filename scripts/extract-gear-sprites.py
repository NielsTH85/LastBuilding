"""
Extract gear sprites from Last Epoch game data and map them to our item bases.
Outputs PNG files to apps/planner-web/public/images/items/
"""
import UnityPy, json, os

BUNDLE = r'C:\ledata\Last Epoch_Data\StreamingAssets\aa\StandaloneWindows64\gear-sprites_visuals_assets_all.bundle'
EQUIP_JSON = r'c:\eob\packages\game-data\src\data\equipment-import.json'
OUT_DIR = r'c:\eob\apps\planner-web\public\images\items'

os.makedirs(OUT_DIR, exist_ok=True)

# Load bundle
print("Loading gear-sprites bundle...")
env = UnityPy.load(BUNDLE)

# Collect all sprites by name
sprites = {}
for obj in env.objects:
    if obj.type.name == 'Sprite':
        d = obj.read()
        sprites[d.m_Name] = obj

print(f"Found {len(sprites)} sprites in bundle")

# Load equipment data
with open(EQUIP_JSON, 'r', encoding='utf-8') as f:
    equip = json.load(f)

# Build name mapping
def name_to_sprite_key(name):
    """Convert item name to sprite lookup key."""
    return name.replace(' ', '_')

# Try to match and extract
matched = 0
unmatched = []
mapping = {}  # item base id -> sprite filename

for item in equip['itemBases']:
    name = item['name']
    item_id = f"{item['baseTypeId']}_{item['subTypeId']}"
    
    # Try exact name match
    sprite_key = name_to_sprite_key(name)
    
    if sprite_key in sprites:
        matched += 1
        filename = f"{item_id}.png"
        mapping[item_id] = filename
        
        # Export sprite
        out_path = os.path.join(OUT_DIR, filename)
        if not os.path.exists(out_path):
            sprite_obj = sprites[sprite_key]
            d = sprite_obj.read()
            img = d.image
            img.save(out_path)
    else:
        unmatched.append((name, item_id, sprite_key))

print(f"\nMatched: {matched}/{len(equip['itemBases'])}")
print(f"Unmatched: {len(unmatched)}")

if unmatched:
    print("\nUnmatched items (first 30):")
    for name, iid, tried in unmatched[:30]:
        print(f"  {name} ({iid}) -> tried '{tried}'")

# Try fuzzy matching for unmatched
print("\n--- Trying fuzzy matching ---")
sprite_keys_lower = {k.lower(): k for k in sprites}
fuzzy_matched = 0
for name, iid, tried in unmatched:
    lower_key = tried.lower()
    if lower_key in sprite_keys_lower:
        real_key = sprite_keys_lower[lower_key]
        fuzzy_matched += 1
        filename = f"{iid}.png"
        mapping[iid] = filename
        
        out_path = os.path.join(OUT_DIR, filename)
        if not os.path.exists(out_path):
            sprite_obj = sprites[real_key]
            d = sprite_obj.read()
            img = d.image
            img.save(out_path)

print(f"Fuzzy matched: {fuzzy_matched}")
print(f"Total matched: {matched + fuzzy_matched}/{len(equip['itemBases'])}")

# Save mapping JSON
mapping_path = os.path.join(r'c:\eob\packages\game-data\src\data', 'item-sprites.json')
with open(mapping_path, 'w', encoding='utf-8') as f:
    json.dump(mapping, f, indent=2)
print(f"\nSaved mapping to {mapping_path}")
print(f"Saved {len(mapping)} sprite images to {OUT_DIR}")
