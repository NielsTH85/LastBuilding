import json

d = json.load(open('maxroll-build-example.json', 'r', encoding='utf-8'))
data = json.loads(d['data']) if isinstance(d.get('data'), str) else d.get('data', d)
items = data.get('items', {})
profiles = data.get('profiles', [])

# Show each profile's item slot mapping
for i, p in enumerate(profiles):
    name = p.get('name', '?')
    print(f"Profile {i}: {name}")
    for slot, idx in p.get('items', {}).items():
        it = items.get(str(idx), {})
        uid = it.get('uniqueID', None)
        itype = it.get('itemType')
        isub = it.get('subType')
        affs = len(it.get('affixes', []))
        label = f" *** UNIQUE {uid} ***" if uid is not None else ""
        print(f"  {slot:10s} -> item#{idx:3d}  type={itype} sub={isub} affixes={affs}{label}")
    print()

# Show all unique items in the data
print("=== All unique items in data ===")
for k, v in items.items():
    uid = v.get('uniqueID')
    if uid is not None:
        print(f"  item#{k}: type={v.get('itemType')} sub={v.get('subType')} uniqueID={uid} uniqueRolls={v.get('uniqueRolls', [])}")

# Check which of those unique base types exist in our equipment data
print("\n=== Checking unique bases against equipment-import.json ===")
eq = json.load(open('../packages/game-data/src/data/equipment-import.json', 'r', encoding='utf-8'))
base_lookup = {}
for b in eq['itemBases']:
    key = f"{b['baseTypeId']}-{b['subTypeId']}"
    base_lookup[key] = b['slot']

for k, v in items.items():
    uid = v.get('uniqueID')
    if uid is not None:
        key = f"{v.get('itemType')}-{v.get('subType')}"
        found = base_lookup.get(key)
        print(f"  item#{k}: {key} -> slot={found or 'NOT FOUND'}")
