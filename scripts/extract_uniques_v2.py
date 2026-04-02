"""
Extract unique items from maxroll's game data.
"""
import urllib.request, json, ssl, os

CACHE_FILE = 'maxroll-game-data.json'
url = 'https://assets-ng.maxroll.gg/leplanner/game/data.json'

# Use cache if available
if os.path.exists(CACHE_FILE):
    print(f"Loading from cache: {CACHE_FILE}")
    with open(CACHE_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)
else:
    print(f"Fetching {url}...")
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    resp = urllib.request.urlopen(req, timeout=60, context=ctx)
    raw = resp.read()
    print(f"Downloaded {len(raw)} bytes")
    data = json.loads(raw)
    with open(CACHE_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, separators=(',', ':'))
    print(f"Cached to {CACHE_FILE}")

print(f"\nTop-level keys: {list(data.keys())}")

# Check if uniques exist
if 'uniques' not in data:
    print("No 'uniques' key. Looking for alternatives...")
    for k in data.keys():
        v = data[k]
        if isinstance(v, list) and len(v) > 0:
            first = v[0]
            if isinstance(first, dict) and 'uniqueID' in first:
                print(f"  Found uniques in '{k}': {len(v)} entries")
else:
    uniques = data['uniques']
    print(f"\nFound {len(uniques)} unique items")
    
    # Show structure of first unique
    if uniques:
        print(f"\nFirst unique keys: {list(uniques[0].keys())}")
        for u in uniques[:3]:
            print(f"\n  #{u.get('uniqueID')}: {u.get('name', '?')}")
            print(f"    displayName: {u.get('displayName', 'N/A')}")
            print(f"    baseType: {u.get('baseType')}, subTypes: {u.get('subTypes')}")
            print(f"    isSetItem: {u.get('isSetItem', False)}")
            print(f"    legendaryType: {u.get('legendaryType', 'N/A')}")
            print(f"    levelReq: {u.get('levelRequirement')}")
            mods = u.get('mods', [])
            print(f"    mods ({len(mods)}):")
            for m in mods[:3]:
                print(f"      {json.dumps(m)}")

    # Check our example build's unique IDs
    needed_ids = [321, 372, 454, 286, 228, 253, 216, 404, 423, 275, 293, 277, 304]
    by_id = {u['uniqueID']: u for u in uniques}
    print(f"\n--- Example build uniques ---")
    for uid in needed_ids:
        u = by_id.get(uid)
        if u:
            print(f"  #{uid}: {u.get('name', '?')} (baseType={u.get('baseType')}, mods={len(u.get('mods', []))})")
        else:
            print(f"  #{uid}: NOT FOUND")

    # Save a minimal uniques JSON for our import
    # We need: uniqueID, name, baseType, subTypes, mods (property + value + maxValue + canRoll)
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
            if m.get('tags') is not None:
                mod_entry['tags'] = m.get('tags')
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
    print(f"\nSaved {len(minimal)} uniques to {out_path}")
    print(f"File size: {os.path.getsize(out_path)} bytes")
