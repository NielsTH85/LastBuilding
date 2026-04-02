"""
Extract unique items data from maxroll's data.json.
"""
import urllib.request, json

url = "https://maxroll.gg/last-epoch/planner/data.json"
print(f"Fetching {url}...")

req = urllib.request.Request(url, headers={
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'application/json',
    'Referer': 'https://maxroll.gg/last-epoch/planner',
})

resp = urllib.request.urlopen(req, timeout=30)
raw = resp.read()
print(f"Downloaded {len(raw)} bytes")

data = json.loads(raw)
print(f"Top-level keys: {list(data.keys())}")

if 'uniques' in data:
    uniques = data['uniques']
    print(f"\nFound {len(uniques)} unique items")
    
    # Show first 5 uniques with their structure
    for u in uniques[:5]:
        print(f"\nUnique #{u.get('uniqueID', '?')}: {u.get('name', '?')} (displayName: {u.get('displayName', 'N/A')})")
        print(f"  baseType: {u.get('baseType')}, subTypes: {u.get('subTypes')}")
        print(f"  levelRequirement: {u.get('levelRequirement')}")
        print(f"  isSetItem: {u.get('isSetItem', False)}")
        print(f"  legendaryType: {u.get('legendaryType', 'N/A')}")
        print(f"  canDropRandomly: {u.get('canDropRandomly', 'N/A')}")
        print(f"  isPrimordialItem: {u.get('isPrimordialItem', False)}")
        mods = u.get('mods', [])
        print(f"  mods ({len(mods)}):")
        for m in mods[:5]:
            print(f"    {json.dumps(m)}")
        # Print all keys of the unique for reference
        print(f"  All keys: {list(u.keys())}")
    
    # Save just the uniques
    with open('maxroll-uniques-raw.json', 'w', encoding='utf-8') as f:
        json.dump(uniques, f, indent=2)
    print(f"\nSaved {len(uniques)} uniques to maxroll-uniques-raw.json")
    
    # Check the unique IDs we need from the example build
    needed_ids = [321, 372, 454, 286, 228, 253, 216, 404, 423, 275, 293, 277, 304]
    print(f"\nChecking needed uniques from example build:")
    by_id = {u['uniqueID']: u for u in uniques}
    for uid in needed_ids:
        u = by_id.get(uid)
        if u:
            print(f"  #{uid}: {u.get('name', '?')} (baseType={u.get('baseType')}, mods={len(u.get('mods', []))})")
        else:
            print(f"  #{uid}: NOT FOUND")
else:
    print("No 'uniques' key found!")
    print(f"Available keys: {list(data.keys())}")
