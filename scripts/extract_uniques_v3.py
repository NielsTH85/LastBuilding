"""
Re-extract unique items from maxroll's game data with specialTag, type, hideInTooltip.
"""
import json, os

CACHE_FILE = 'maxroll-game-data.json'

with open(CACHE_FILE, 'r', encoding='utf-8') as f:
    data = json.load(f)

uniques = data['uniques']
print(f"Found {len(uniques)} unique items")

minimal = []
for u in uniques:
    mods_min = []
    for m in u.get('mods', []):
        mod_entry = {
            'property': m.get('property'),
            'value': m.get('value'),
        }
        if m.get('canRoll'):
            mod_entry['canRoll'] = True
            mod_entry['maxValue'] = m.get('maxValue')
        if m.get('tags') is not None and m['tags'] != 0:
            mod_entry['tags'] = m['tags']
        if m.get('specialTag', 0) != 0:
            mod_entry['specialTag'] = m['specialTag']
        if m.get('type', 0) != 0:
            mod_entry['type'] = m['type']
        if m.get('hideInTooltip', False):
            mod_entry['hideInTooltip'] = True
        mods_min.append(mod_entry)
    
    entry = {
        'uniqueID': u['uniqueID'],
        'name': u.get('name', ''),
        'baseType': u.get('baseType'),
        'subTypes': u.get('subTypes', []),
        'mods': mods_min,
    }
    if u.get('displayName'):
        entry['displayName'] = u['displayName']
    if u.get('isSetItem'):
        entry['isSetItem'] = True
        if u.get('setID') is not None:
            entry['setID'] = u['setID']
    if u.get('legendaryType') is not None:
        entry['legendaryType'] = u['legendaryType']
    if u.get('levelRequirement') is not None:
        entry['levelRequirement'] = u['levelRequirement']
    if u.get('isPrimordialItem'):
        entry['isPrimordialItem'] = True
    if u.get('overrideLevelRequirement'):
        entry['overrideLevelRequirement'] = True
    if u.get('loreText'):
        entry['loreText'] = u['loreText']
    minimal.append(entry)

out_path = '../packages/game-data/src/data/uniques-import.json'
with open(out_path, 'w', encoding='utf-8') as f:
    json.dump(minimal, f, separators=(',', ':'))

size = os.path.getsize(out_path)
print(f"Saved {len(minimal)} uniques to {out_path}")
print(f"File size: {size} bytes ({size//1024}KB)")

# Verify ladle
for u in minimal:
    if 'Ladle' in u['name']:
        print(f"\nVerify Ladle mods:")
        for m in u['mods']:
            print(f"  {json.dumps(m)}")
        break
