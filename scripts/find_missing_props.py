import re, json

js = open('planner_asset.js', 'r', encoding='utf-8').read()

# Extract the property enum
idx = js.find('DamageTakenAsVoid=')
start = js.rfind('(function', max(0, idx - 5000), idx)
end = js.find('}({})', idx)
block = js[start:end+5]

# Parse enum entries: e[e.Name=Value]="Name"
entries = re.findall(r'e\[e\.(\w+)=(\d+)\]', block)
enum_map = {}
for name, val in entries:
    enum_map[int(val)] = name

# Load equipment-import to check property IDs used
eq = json.load(open('../packages/game-data/src/data/equipment-import.json', 'r', encoding='utf-8'))
prop_names = json.load(open('../packages/game-data/src/data/property-names.json', 'r', encoding='utf-8'))
known = set(int(k) for k in prop_names.keys())

# Collect all property IDs used in our data
all_used = set()
for base in eq['itemBases'].values() if isinstance(eq['itemBases'], dict) else eq['itemBases']:
    if isinstance(base, dict):
        for imp in base.get('implicits', []):
            all_used.add(imp['property'])
for aff in eq['affixes']:
    for p in aff.get('properties', []):
        all_used.add(p['property'])

uniques = json.load(open('../packages/game-data/src/data/uniques-import.json', 'r', encoding='utf-8'))
for u in uniques:
    for mod in u.get('mods', []):
        all_used.add(mod['property'])

missing = sorted(all_used - known)
print(f"All used property IDs: {sorted(all_used)[-20:]}")
print(f"Missing: {missing}")
print()

# For each missing, check affix stat field for clues
for pid in missing:
    print(f"Property {pid}:")
    # Check affixes
    for aff in eq['affixes']:
        for p in aff.get('properties', []):
            if p['property'] == pid:
                print(f"  Affix: {aff['name']} | stat: {p.get('stat','')} | propertyName: {p.get('propertyName','')}")
    
    # Check bases
    for base in (eq['itemBases'].values() if isinstance(eq['itemBases'], dict) else eq['itemBases']):
        if isinstance(base, dict):
            for imp in base.get('implicits', []):
                if imp['property'] == pid:
                    print(f"  Base: {base['name']} | stat: {imp.get('stat','')} | value: {imp.get('value','')} | maxValue: {imp.get('maxValue','')}")
                    break
    
    # Check uniques (first 3)
    count = 0
    for u in uniques:
        for mod in u.get('mods', []):
            if mod['property'] == pid and count < 3:
                print(f"  Unique: {u['name']} | value: {mod.get('value','')} | tags: {mod.get('tags',0)}")
                count += 1
    print()
